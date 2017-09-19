Sysdig Inspect
================

Sysdig Inspect is an interactive sysdig trace file analyzer that runs on your Mac or your PC.

The Inspector's user interface is designed to intuitively navigate the data-dense sysdig captures that contain granular system, network and application activity of a Linux system. Sysdig Inspector helps you understand trends, correlate metrics and find the needle in the haystack. It comes packed with features designed to support both performance and security investigations, and fully supports comtainers introspection.

To use Sysdig Inspect, you need trace files collected on Linux with [sysdig](https://github.com/draios/sysdig).

Main Features
---
**Capture highlights**
(screenshot)

The overview page offers an out of the box, at a glace summary of the content of the trace file. It includes highlights of resource utilization, file and network activity, security and performance issues and more.

**Sub-second microtrends and metric correlation**
(screenshot)(gif?)

Any tile in the overview page can be clicked to see the sub-second trend of the selected metric. Multiple tiles can be selected to see how metrics correlate to each other and identify root causes.

**Deep drill down**
(screenshot)(gif?)

You can double-click on a tile to see the data behind it. Click on the data or use the time line to further refine what you see.

**Network, file and IPC payloads visualization**
(screenshot)

Visualize the actual payloads that are read or written to files, network connections, pipes, unix sockets and any other type of file descriptor. 

**Sysdig integration**
(screenshot)

View granular sysdig events for arbitrary selections.

Where to start?
---

**Installing Sysdig Inspector**

**Creating a trace file**

**Example Trace files**

Support
---

For support using sysdig, please contact the official mailing list.

Join the Community
---
* Contact the [official mailing list](https://groups.google.com/forum/#!forum/sysdig) for support and to talk with other users
* Follow us on [Twitter](https://twitter.com/sysdig)
* This is our [blog](https://sysdig.com/blog/). There are many like it, but this one is ours.
* Join our [Public Slack](https://slack.sysdig.com) channel for sysdig announcements and discussions.
