web: gunicorn server:app --preload --bind 0.0.0.0:$PORT --worker-class gthread --workers 2 --threads 8 --timeout 120 --graceful-timeout 30 --keep-alive 5
