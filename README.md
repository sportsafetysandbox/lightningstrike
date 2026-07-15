# lightningstrike
Show location of lightning strikes in Singapore, within a given location radius, over a given time window.

### Version 1

A lightning simulation app that allows me to visually display the locations of cloud-to-cloud (C2C) and cloud-to-ground (C2G) lightning occurrences within 12km radius of a given location, over a given Date and Time Window.

Hosting Location:

https://sportsafetysandbox.github.io/lightningstrike/

Datasets: 

- Use NEA API via data.gov.sg to fetch the weather data.

User Input:

- Map Location (Lat and Long):
- Start: Date (dd/mm/yy)/ Time (xxxx hrs)
- End: Date (dd/mm/yy)/ Time (xxxx hrs)

Visual Display:

- Base Map: **28 km** by **28km** map Square with **Given Location** in the **centre.**
- Map Pin: Indicating the **Given Location**.
- Table 1: Cloud to Cloud History (Lat, Long, Time, Distance from Given Location)
- Table 2: Cloud to Ground History (Lat, Long, Time, Distance from Given Location)
- Overlay 1 (with toggle): **Concentric Circles** in Red (**2km** intervals, up to **8km**) with the **Given Location** as its **centre**.
- Overlay 2 (with toggle): **Cloud-to-Cloud Lightning** locations indicated by white lightning icons. Leave the icons in place after plotting - do not remove after plotting.
- Overlay 3 (with toggle): **Cloud-to-Ground Lightning** locations indicated by yellow lightning icons. Leave the icons in place after plotting - do not remove after plotting.
- Time Slider: From Time Window Start to Time Window End. Allows me to slide manually back and forth
- Play/Pause Button: Allows Overlay 2 and Overlay 3 to plot the locations of the lightning strikes based on the time of occurrence within the time window (Play Rate of 2 mins intervals for every second play).
- Fast Forward Button: Accelerates the video play rate at every click (acceleration by x2, x4, back to normal)
- Refresh Button: Resets the page retaining the earlier Given Location, but clearing the Start and End input windows.
