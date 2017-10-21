# amazon-dash-server
Finds the Dash button on network. It scans the subnet for button by comparing the devices' MAC address against known Amazon MAC addresses. Once you have the IP address, you can watch for a button press.

This application was developed to run on a Windows machine. There are a lot other and better solutions for Linux/MacOS which don't translate very well to a Windows solution.

## Setup

This project assumes that you already have NPM installed. Run the following commands to get started.

Install all the dependencies: `npm install`

Run the server: `npm start`

Visit in web browser: `localhost:3000`