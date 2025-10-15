import { supabase } from './supabaseClient';

export interface InjuryReport {
  id: number;
  player_name: string;
  external_player_id?: string;
  team_name: string;
  position?: string;
  injury_status: string;
  estimated_return_date?: string;
  description?: string;
  sport: string;
  source: string;
  source_url?: string;
  scraped_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InjuryStats {
  totalInjuries: number;
  criticalInjuries: number;
  expectedReturns: number;
  affectedTeams: number;
  lastUpdated: string;
}

export interface InjurySummary {
  status: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

class InjuryService {
  /**
   * Get all active MLB injury reports
   */
  async getMLBInjuries(): Promise<InjuryReport[]> {
    try {
      const { data, error } = await supabase
        .from('injury_reports')
        .select('*')
        .eq('sport', 'MLB')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching MLB injuries:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMLBInjuries:', error);
      return [];
    }
  }

  /**
   * Get injury statistics for today
   */
  async getInjuryStats(): Promise<InjuryStats> {
    try {
      const injuries = await this.getMLBInjuries();
      
      const criticalStatuses = ['60-Day-IL', '15-Day-IL', 'Out'];
      const criticalInjuries = injuries.filter(injury => 
        criticalStatuses.includes(injury.injury_status)
      ).length;

      const expectedReturns = injuries.filter(injury => 
        injury.estimated_return_date && 
        new Date(injury.estimated_return_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ).length;

      const uniqueTeams = new Set(injuries.map(injury => injury.team_name).filter(Boolean));

      return {
        totalInjuries: injuries.length,
        criticalInjuries,
        expectedReturns,
        affectedTeams: uniqueTeams.size,
        lastUpdated: injuries.length > 0 ? injuries[0].scraped_at : new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting injury stats:', error);
      return {
        totalInjuries: 0,
        criticalInjuries: 0,
        expectedReturns: 0,
        affectedTeams: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Get injury summary by status
   */
  async getInjurySummary(): Promise<InjurySummary[]> {
    try {
      const injuries = await this.getMLBInjuries();
      const statusCounts: { [key: string]: number } = {};
      
      // Count injuries by status
      injuries.forEach(injury => {
        statusCounts[injury.injury_status] = (statusCounts[injury.injury_status] || 0) + 1;
      });

      const total = injuries.length;
      const summary: InjurySummary[] = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        trend: 'stable' // We'd need historical data to determine trend
      }));

      // Sort by count (highest first)
      return summary.sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error getting injury summary:', error);
      return [];
    }
  }

  /**
   * Get critical injuries (high impact)
   */
  async getCriticalInjuries(): Promise<InjuryReport[]> {
    try {
      const injuries = await this.getMLBInjuries();
      const criticalStatuses = ['60-Day-IL', '15-Day-IL', 'Out'];
      
      return injuries.filter(injury => 
        criticalStatuses.includes(injury.injury_status)
      ).slice(0, 5); // Top 5 critical injuries
    } catch (error) {
      console.error('Error getting critical injuries:', error);
      return [];
    }
  }

  /**
   * Get formatted status for display
   */
  getStatusDisplayInfo(status: string) {
    const statusMap: { [key: string]: { label: string; color: string; icon: string } } = {
      'Day-To-Day': { label: 'Day-to-Day', color: '#F59E0B', icon: '⚠️' },
      '10-Day-IL': { label: '10-Day IL', color: '#EF4444', icon: '🏥' },
      '15-Day-IL': { label: '15-Day IL', color: '#DC2626', icon: '🚑' },
      '60-Day-IL': { label: '60-Day IL', color: '#991B1B', icon: '🔴' },
      'Out': { label: 'Out', color: '#7F1D1D', icon: '❌' },
      'Doubtful': { label: 'Doubtful', color: '#EA580C', icon: '❓' },
      'Questionable': { label: 'Questionable', color: '#D97706', icon: '🤔' },
      'Probable': { label: 'Probable', color: '#10B981', icon: '✅' }
    };

    return statusMap[status] || { label: status, color: '#6B7280', icon: '📊' };
  }

  /**
   * Format return date for display
   */
  formatReturnDate(dateString?: string): string {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks`;
    return `${Math.ceil(diffDays / 30)} months`;
  }
}

export const injuryService = new InjuryService(); 