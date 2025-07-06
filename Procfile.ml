web: cd python-services/sports-betting-api && gunicorn ml_prediction_server:app --bind 0.0.0.0:$PORT
