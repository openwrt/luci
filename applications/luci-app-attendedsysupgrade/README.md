# luci-app-attendedsysupgrade

This app allows firmware upgrades of routers while keeping user installed packages.
To do so the app sends a request to an *Atttended SysUpgrade server* which will
respond with a custom image, containing all previously installed packages.

The process takes per images between 30 seconds and 5 minutes, please be
patient.

More information on the backend server and how to host one are available on the
projects page: https://github.com/aparcar/asu/
