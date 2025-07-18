# Setting Up Daily Automation Cron Job

This document provides instructions for setting up the ParleyApp daily automation process to run automatically using cron.

## Making the Script Executable

First, make the automation script executable:

```bash
chmod +x /home/reid/Desktop/parleyapp/daily-automation.sh
```

## Setting Up the Cron Job

You can set up a cron job to run the automation script daily at a specific time.

1. Open your crontab for editing:

```bash
crontab -e
```

2. Add the following line to run the script daily at 6 AM:

```
0 6 * * * /home/reid/Desktop/parleyapp/daily-automation.sh
```

Or to run at another time (e.g., 8 AM):

```
0 8 * * * /home/reid/Desktop/parleyapp/daily-automation.sh
```

3. Save and exit the editor.

## Verifying the Cron Job

To verify that your cron job is set up correctly:

```bash
crontab -l
```

This should display your crontab with the line you added.

## Testing the Automation Script

To test the automation script without waiting for the scheduled time:

```bash
/home/reid/Desktop/parleyapp/daily-automation.sh
```

## Logs

The automation script creates detailed logs in:
- `/home/reid/Desktop/parleyapp/logs/daily-automation-YYYY-MM-DD.log` (Main log)
- `/home/reid/Desktop/parleyapp/logs/odds-integration.log` (Odds integration log)
- `/home/reid/Desktop/parleyapp/logs/main-py.log` (AI predictions log)
- `/home/reid/Desktop/parleyapp/logs/plockinsights.log` (Professor Lock insights log)
- `/home/reid/Desktop/parleyapp/logs/injury-update.log` (Injury reports log)
- `/home/reid/Desktop/parleyapp/logs/statmuse-server.log` (StatMuse API server log)

## Troubleshooting

If the cron job doesn't run as expected:

1. Make sure the script is executable: `chmod +x /home/reid/Desktop/parleyapp/daily-automation.sh`
2. Check if any environment variables need to be set in the cron environment
3. Verify the path to the script is correct
4. Check the logs for error messages

## Environment Variables

If your script relies on environment variables that are set in your `.env` file, make sure to:

1. Use absolute paths in the script
2. Source any necessary environment files at the beginning of the script

For a more robust setup, you might consider using a service manager like systemd instead of cron.
