   # One-off notebook or script
import joblib, numpy as np
model = joblib.load("models/mlb_hits_real_model.pkl")["model"]
X = np.random.rand(10, model.n_features_in_)   # random features
print(model.predict(X)[:10])