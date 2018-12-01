# Helper API for IoT devices

Let's say I have a handful of IoT devices I've built (of the Arduino, Raspberry Pi kind). These devices have some (configuration) parameters like frequency of checks, thresholds, time intervals etc. Modifying those parameters requires reprogramming the device, which sometimes is located in an inconvenient spot. Additionally the devices notify of various events via email. Some devices don't have enough resources to do SSL/TLS, and as of late this is pretty much mandatory. Most ISPs block the unsecure port 25, and a lot of SMTP servers don't offer it.

To help IoT devices with the above two cases, this app provides:
* An API to retrieve configuration parameters for a device.
* An API to send a notification email.
* UI page to configure the above.

Both API return the standard Date header, which could be used by the device to keep time. In addition a non-standard header *X-IoT-UtcTime* is also returned. It provides UTC time in yyyyMMddHHmmss format, which could be easier to parse by the device.

## Configuration API
The **GET** end point is:
```
http://YourOpenWrt/cgi-bin/luci/iot/api/config?deviceid=sump
```
The deviceid is expected to be known and supplied by the calling device. The response is as configured for the given device id, and it is text in some format the device understands. 400 is returned if you call the end point with method other than GET. 404 is returned if a configuration can not be retrieved for the device.

## Notification API
The **POST** end point is:
```
http://YourOpenWrt/cgi-bin/luci/iot/api/notify?eventid=gdoor_late_closed
```
An email is sent as configured for the event id. The calling device can supply text in the POST body, which gets appended to the email message. 400 is returned if the call was not POST. 404 is returned if a configuration for the event id is not found. 500 is returned if there's problem with sending the email.

## Configuration UI
From the top OpenWRT menu the page is available at System -> IoT Configuration. The UCI configuration file, which the UI page manages is at `/etc/config/iot`.

The page consists of four tabs.

### SMTP Server
Enter parameters for your SMTP server. The app has been successfully tested with smtp2go on their unsecure port 2525. Follow their directions on setting up SPF and DKIM. It has also been successfully tested with gmail on port 465 (SSL). Consult [Send email from app](https://support.google.com/a/answer/176600) using a [generated app password](https://support.google.com/mail/answer/185833).

With gmail, for best results the **From** address should be formatted as ```<your.name@example.com>```.

### Event Config
Create an entry for each event you want handled from the API. You start by entering an event id, and then filling the rest of the fields for it. Recipients should be comma separated. Any text POSTed on the event API will be appended to the message entered here.

### Device Config
Create an entry for each device. Start by entering a device id, and then filling the rest of the fields. The Configuration field is text in a format that can be parsed by the device. Could be positional like a one-liner of comma separated values, or a value per line. Or it could be structured like json. The Comment field has no functional use. It could be used to describe the order of parameters in the Configuration field.

### General
You can specify a default event id and a default device id. Those are expected to match one of the ids already set up on the corresponding tabs. If an API call is made with missing or unrecognized id, the default one will be used to complete the request.

## Notes and Considerations
* Some devices have more critical functions than others. Consider the sump water level monitor. If the level reaches the critical threshold, most likely the battery-powered backup pump is operating. Which most likely means the power is out. And then my regular machines are off. I would have only the cable modem and the OpenWRT router running on the UPS. So OpenWRT is the one that could handle the notification from the device in such circumstances.

* The provided API in this app allows controlling various aspects of an IoT device behavior without the need to reprogram it. At regular intervals the device will request its configuration parameters, and update its own state accordingly. Of course it needs to be programmed initially to use the API, but after that only major code updates will require fetching the device, and reprogramming it.

* With the above in place, one could envision an external process orchestrating the devices in some intelligent way. An API to update the configurations could be added down the road. As an example a script driven by NUT (Network UPS Tools) could set a 'power:off' parameter in the UCI file. Battery powered devices could then act accordinly.

* As it is, this app is targeted to support a handful of devices in a home environment. It certainly won't scale in an environment with hundreds of devices, and it is missing features to support a fleet (or swarm) of devices.

* The password for the SMTP server is stored in clear text in the UCI file. This is less than ideal. (Suggestions to fix this are welcome.) Be mindful of that, and ensure restricted access to the OpenWRT device. It is also a good idea to create and use a separate email account just for this purpose to avoid the risk of compromising your primary email account.

* There's nothing preventing device A from pulling the configuration for device B. It doesn't even have to be one of the IoT devices. Similarly there's nothing preventing some code on the network to fire an event notication. Use a secure WiFi network.
