-- Create support requests table
CREATE TABLE public.support_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'account', 'feature_request', 'other')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback table
CREATE TABLE public.feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('general', 'feature_request', 'bug_report', 'ai_suggestion', 'ui_improvement')),
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for support_requests
CREATE POLICY "Users can insert their own support requests"
    ON public.support_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own support requests"
    ON public.support_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Create policies for feedback
CREATE POLICY "Users can insert their own feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
    ON public.feedback FOR SELECT
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT, SELECT ON public.support_requests TO authenticated;
GRANT INSERT, SELECT ON public.feedback TO authenticated; 