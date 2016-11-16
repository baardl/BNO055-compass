//
// Copyright 2014, Evothings AB
//
// Licensed under the Apache License, Version 2.0 (the "License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// RedBearLab - Simple Control
// version: 0.4 - 2014-12-11
//

document.addEventListener(
	'deviceready',
	function() { evothings.scriptsLoaded(app.initialize) },
	false);

var app = {};

var analog_enabled;

app.RBL_SERVICE_UUID = '713d0000-503e-4c75-ba94-3148f18d941e';
app.RBL_CHAR_TX_UUID = '713d0002-503e-4c75-ba94-3148f18d941e';
app.RBL_CHAR_RX_UUID = '713d0003-503e-4c75-ba94-3148f18d941e';
app.RBL_TX_UUID_DESCRIPTOR = '00002902-0000-1000-8000-00805f9b34fb';
var ctx = null;
var isImgsLoaded = false;

app.initialize = function() {
	console.log("Initialize");
	app.connected = false;
	analog_enabled = true;
	var canvas = document.getElementById('canvas');

	// Canvas supported?
	if (canvas.getContext('2d')) {
		ctx = canvas.getContext('2d');

		// Load the needle image
		needle = new Image();
		needle.src = 'img/needle.png';

		// Load the compass image
		var img2 = document.getElementsByName('compass');
		console.log("compass " + JSON.stringify(img2));
		img = new Image();
		img.src = 'img/compass.png';
		img.onload = imgLoaded;
		checkImage(img2.src, function(){ console.log("Loaded " + img.src); }, function(){ console.log("Failed to load " + img.src); } );
	} else {
		console.log("Canvas not supported!");
	}
};

function checkImage(imageSrc, good, bad) {
	var img = new Image();
	img.onload = good;
	img.onerror = bad;
	img.src = imageSrc;
}



app.startScan = function()
{
	app.disconnect();

	console.log('Scanning started...');

	app.devices = {};

	var htmlString =
		'<img src="img/loader_small.gif" style="display:inline; vertical-align:middle">' +
		'<p style="display:inline">   Scanning...</p>';

	$('#scanResultView').append($(htmlString));

	$('#scanResultView').show();

	function onScanSuccess(device)
	{
		if (device.name != null)
		{
			app.devices[device.address] = device;

			console.log('Found: ' + device.name + ', ' +
				device.address + ', ' + device.rssi);

			var htmlString =
				'<div class="deviceContainer" onclick="app.connectTo(\'' +
					device.address + '\')">' +
				'<p class="deviceName">' + device.name + '</p>' +
				'<p class="deviceAddress">' + device.address + '</p>' +
				'</div>';

			$('#scanResultView').append( $( htmlString ) );
		}
	}

	function onScanFailure(errorCode)
	{
		// Show an error message to the user
		app.disconnect('Failed to scan for devices.');

		// Write debug information to console.
		console.log('Error ' + errorCode);
	}

	evothings.easyble.reportDeviceOnce(true);
	evothings.easyble.startScan(onScanSuccess, onScanFailure);

	$('#startView').hide();
};

app.setLoadingLabel = function(message)
{
	console.log(message);
	$('#loadingStatus').text(message);
}

app.connectTo = function(address)
{
	device = app.devices[address];

	$('#loadingView').css('display', 'table');

	app.setLoadingLabel('Trying to connect to ' + device.name);

	function onConnectSuccess(device)
	{

		function onServiceSuccess(device)
		{
			// Application is now connected
			app.connected = true;
			app.device = device;

			console.log('Connected to ' + device.name);

			device.writeDescriptor(
				app.RBL_CHAR_TX_UUID,
				app.RBL_TX_UUID_DESCRIPTOR,
				new Uint8Array([1,0]),
				function()
				{
					console.log('Status: writeDescriptor ok.');

					$('#loadingView').hide();
					$('#scanResultView').hide();
					$('#controlView').show();
				},
				function(errorCode)
				{
					// Disconnect and give user feedback.
					app.disconnect('Failed to set descriptor.');

					// Write debug information to console.
					console.log('Error: writeDescriptor: ' + errorCode + '.');
				}
			);

			function failedToEnableNotification(erroCode)
			{
				console.log('BLE enableNotification error: ' + errorCode);
			}

			//console.log('Try to enable notifications from ' + app.RBL_CHAR_TX_UUID);
			device.enableNotification(
				app.RBL_CHAR_TX_UUID,
				app.receivedData,
				function(errorcode)
				{
					console.log('BLE enableNotification error: ' + errorCode);
				}
			);

		};

		function onServiceFailure(errorCode)
		{
			// Disconnect and show an error message to the user.
			app.disconnect('Device is not from RedBearLab');

			// Write debug information to console.
			console.log('Error reading services: ' + errorCode);
		};

		app.setLoadingLabel('Identifying services...');

		// Connect to the appropriate BLE service
		device.readServices(
			[app.RBL_SERVICE_UUID],
			onServiceSuccess,
			onServiceFailure
		);
	};

	function onConnectFailure(errorCode)
	{
		// Disconnect and show an error message to the user.
		app.disconnect('Disconnected from device');

		// Write debug information to console
		console.log('Error ' + errorCode);
	};

	// Stop scanning
	evothings.easyble.stopScan();

	// Connect to our device
	console.log('Identifying service for communication');
	device.connect(onConnectSuccess, onConnectFailure);
};

app.sendData = function(data)
{
	if (app.connected)
	{
		function onMessageSendSucces()
		{
			console.log('Succeded to send message.');
		}

		function onMessageSendFailure(errorCode)
		{
			console.log('Failed to send data with error: ' + errorCode);
			app.disconnect('Failed to send data');
		}

		data = new Uint8Array(data);

		app.device.writeCharacteristic(
			app.RBL_CHAR_RX_UUID,
			data,
			onMessageSendSucces,
			onMessageSendFailure
		);
	}
	else
	{
		// Disconnect and show an error message to the user.
		app.disconnect('Disconnected');

		// Write debug information to console
		console.log('Error - No device connected.');
	}
};

var previousX = 90;
var previousY = 90;
var currentX = 90;
var currentY = 90;
var img = null,
	needle = null,
	degrees = 0;

function clearCanvas() {
	// clear canvas
	console.log("Clear canvas");
	ctx.clearRect(0, 0, 200, 200);
}
app.receivedData = function(data)
{
	if (app.connected)
	{
		var data = new Uint8Array(data);
		console.log("Data recieived: " + JSON.stringify(data));

		if (data[0] === 0x0A)
		{
			$('#digitalInputResult').text(data[1] ? 'High' : 'Low');
		}
		else if (data[0] === 0x0B)
		{
			//if (analog_enabled)
			//{
				var number = (data[1] << 8) | data[2];
				$('#analogDigitalResult').text(number);
			//}
			/*
			var c = document.getElementById("canvas");
			var ctx = c.getContext("2d");
			currentX = number/2;
			currentY = number/2;
			ctx.beginPath();
			console.log("pX")
			ctx.moveTo(previousX, previousY);
			ctx.lineTo(currentX, currentY);
			ctx.stroke();
			previousX = currentX;
			previousY = currentY;
			*/

			if (isImgsLoaded) {
				degrees = number;
				//clearCanvas();
				ctx.clearRect(0, 0, 200, 200);
				// Draw the compass onto the canvas
				if (typeof ctx == "undefined") {
					console.log("ctx undefined");
				}
				if (typeof ctx == "broken") {
					console.log("ctx broken");
				}
				if (typeof img == "undefined") {
					console.log("img undefined");
				}
				if (typeof img == "broken") {
					console.log("img broken");
				}
				ctx.drawImage(img, 0, 0);
				// Save the current drawing state
				ctx.save();
				// Now move across and down half the
				ctx.translate(100, 100);
				// Rotate around this point
				ctx.rotate(degrees * (Math.PI / 180));
				// Draw the image back and up
				ctx.drawImage(needle, -100, -100);
				// Restore the previous drawing state
				ctx.stroke();
				ctx.restore();
				/*
				startPoint = {
					x: number,
					y: number
				};
				endPoint = {
					x: startPoint.x + 100,
					y: startPoint.y + 100
				};
				ctx.translate(100, 100);
				ctx.rotate(degrees * (Math.PI / 180));
				ctx.translate(-100, -100);

				// draw line
				ctx.moveTo(startPoint.x, startPoint.y);
				ctx.lineTo(endPoint.x, endPoint.y);
				ctx.stroke();
				ctx.closePath();

				ctx.setTransform(1, 0, 0, 1, 0, 0);
				*/
			} else {
				console.log("Images are not loaded.");
			}

			console.log('Number: ' + number);

		}

		//console.log('Data received: [' + data[0] +', ' + data[1] + ', ' + data[2] + ']');
		//console.log('Data is ' + JSON.stringify(data) + ': Lenght: ' + data.length);
		//var numb1 = (data[1] << 8) | data[2];

	}
	else
	{
		// Disconnect and show an error message to the user.
		app.disconnect('Disconnected');

		// Write debug information to console
		console.log('Error - No device connected.');
	}
};
function imgLoaded() {
	// Image loaded event complete.  Start the timer
	console.log("Images are loaded.");
	console.log("img" + img);
	isImgsLoaded = true;
	//setInterval(draw, 100);
}

app.disconnect = function(errorMessage)
{
	if (errorMessage)
	{
		navigator.notification.alert(errorMessage, function() {});
	}

	app.connected = false;
	app.device = null;

	// Stop any ongoing scan and close devices.
	evothings.easyble.stopScan();
	evothings.easyble.closeConnectedDevices();

	console.log('Disconnected');

	$('#loadingView').hide();
	$('#scanResultView').hide();
	$('#scanResultView').empty();
	$('#controlView').hide();
	$('#startView').show();
};

app.toggelAnalog = function()
{
	if (analog_enabled)
	{
		analog_enabled = false;
		app.sendData([0xA0,0x00,0x00]);
		$('#analogDigitalResult').text('-');
		$('#analogToggleButton').text('Enable Analog');
		$('#analogToggleButton').removeClass('blue wide').addClass('green wide');
	}
	else
	{
		analog_enabled = true;
		app.sendData([0xA0,0x01,0x00]);
		$('#analogToggleButton').text('Disable Analog');
		$('#analogToggleButton').removeClass('green wide').addClass('blue wide');
	}
};
