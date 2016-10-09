var dataUtils = require("./data-utils.js");
var constants = require("./zha-constants.js");
var events = require("events");
const assert = require("assert");

var commands = constants.commands;

function ZHAHost(port) {
    events.EventEmitter.call(this);
    this.serialPort = port;
    this.messageSQ = 0;
    this.on("networkSetResponse", function(message) {
        console.log("network set");
        this.emit("versionUpdated", message.dataObject);
    });
    this.on("getVersionAck", function(message) {
        this.emit("versionUpdated", message.dataObject);
    });
    this.on("networkParamAck", function(message) {
        var messageData = message.dataObject;
        if(messageData.status == constants.commandStatus.ok) {
            if(messageData.operation == constants.networkOperations.read) {
                for(var configurationKey in constants.networkConfigurations) {
                    var configurationId = constants.networkConfigurations[configurationKey];
                    if(configurationId == messageData.configuration) {
                        var param = new Object();
                        param[configurationKey] = messageData.value;
                        this.updateNetworkParam(param);
                        break;
                    }
                }
            }
        }
    });
    this.on("updateAddressResponse", function(message) {
        var messageData = message.dataObject;
        this.updateLightNwkAddr(messageData.macAddr, messageData.nwkAddr);
    });
    this.on("getNwkAddrByMacResponse", function(message) {
        var messageData = message.dataObject;
        if(messageData.status == constants.commandStatus.ok)
            this.updateLightNwkAddr(message.dataObject.macAddr, message.nwkAddr);
    });
    this.on("detachedResponse", function(message) {
        var light = this.getLight('nwkAddr', message.nwkAddr);
        if(light) {
            var lightIndex = this.lights.indexOf(light);
            this.lights.splice(lightIndex, 1);
            this.emit("deviceDetached", light);
        }
    })
    this.on("powerAck", function(message) {
        var nwkAddr = message.nwkAddr;
        this.onCommand(commands.light.getPower, {'nwkAddr': nwkAddr});
    });
    this.on("getPowerResponse", function(message) {
        var light = this.getLight('nwkAddr', message.nwkAddr);
        if(light) {
            if(message.dataObject) {
                var power = message.dataObject.power;
                if(power == constants.lightingPower.on)
                    light.power = 'on';
                else if(power == constants.lightingPower.off)
                    light.power = 'off';
                this.emit("lightPowerUpdated", light);
            }
        }
    });
}

ZHAHost.prototype.__proto__ = events.EventEmitter.prototype;

function ZHALight(_id, _uid) {
	this.id = _id;
    if(_uid) {
        this.uid = _uid;
        //var macAddrBuffer = dataUtils.hexDecode(this.uid);
        //this.macAddr = new Buffer(macAddrBuffer);
        this.macAddr = new Buffer(this.uid, "hex");
    }
	this.nwkAddr = 0;
	this.power = 'unknown';
	this.isOn = function() {
		return (this.power == 'on');
	}
}

var Message = function(_layer, _command) {
	this.layer = _layer;
	this.command = _command;
	this.addrType = constants.addrTypes.nwkUnicast;
	this.nwkAddr = 0;
	this.endpoint = 0;
}

var messageLengthMin = 10;
var messageLengthMax = 100;

var rxBuffer = new Buffer(messageLengthMax);
var rxBufferLen = 0;

commands.network.getNwkAddrByMac.buildMessage = function(host, message, param) {
    message.addrType = constants.addrTypes.macUnicast;
    return true;
};

ZHAHost.prototype.buildLightMessage = function(message, param) {
    if(param.id) {
        var light = this.getLight('id', param.id);
        if(light)
            message.nwkAddr = light.nwkAddr;
        else if(param.id == 'all')
            message.nwkAddr = constants.nwkAddrAll;
        else
            return false;
    }
    else if(param.nwkAddr)
        message.nwkAddr = param.nwkAddr;
    else
        return false;
    message.endpoint = constants.lightingEndpoint;
    return true;
};

ZHAHost.prototype.onCommand = function(command, param) {
    var categoryKey = null;
    //find category/command key
    var commandFound = false;
    for(var iCategoryKey in commands) {
        var category = commands[iCategoryKey];
        for(var commandKey in category) {
            var iCommand = category[commandKey];
            if(iCommand == command) {
                categoryKey = iCategoryKey;
                console.log('on command: ' + commandKey);
                commandFound = true;
                break;
            }
        }
        if(commandFound)
            break;
    }
    var message = new Message(command.layer, command.id);
    if(command.buildMessage) {
        if(!command.buildMessage(this, message, param)) {
            console.log("build message failed, may be something wrong with param: ");
            console.log(param);
            return;
        }
    }
    else if(categoryKey == "light")
        this.buildLightMessage(message, param);
        
    if(command.data.send)
        try {
            message.data = this.makeCommandData(command.data.send, param);
        }
        catch(err) {
            console.log("make command data failed due to error: " + err);
            return;
        }
    this.sendMessage(message);
};

ZHAHost.prototype.onUserCommand = function(commandPath, paramStr) {
    if(commandPath.length == 0)
        return;
    console.log(`onUserCommand ${commandPath}` + (paramStr ? (': ' + paramStr) : ''));
    var parts = commandPath.split(".");
    if(parts.length == 2) {
        var categoryKey = parts[0];
        var commandKey = parts[1];
        var category = commands[categoryKey];
        if(category) {
            var command = category[commandKey];
            if(command) {
                if(paramStr) {
                    var param;
                    try{
                        param = JSON.parse(paramStr);
                    }
                    catch(err) {
                        console.log("parse param to JSON failed: " + err);
                    }
                    if(param)
                        this.onCommand(command, param);
                    else
                        console.log("cannot parse param to JSON");
                }
                else
                    this.onCommand(command);
            }
            else
                console.log(`no command of "${commandKey}" found in category "${categoryKey}"`);
        }
        else
            console.log(`no command category of "${categoryKey}" found`);
    }
    else
        console.log("cannot parse commandPath");
};

ZHAHost.prototype.sendMessage = function(message) {
    var dataLength = 0;
    if(message.data)
        dataLength = message.data.length;
    var length = messageLengthMin + dataLength;
    var buffer = new Buffer(length);
    buffer[0] = 0xFE;
    buffer[1] = length;
    buffer[2] = message.layer;
    buffer[3] = message.command;
    buffer[4] = message.addrType;
    buffer.writeUInt16LE(message.nwkAddr, 5);
    buffer[7] = message.endpoint;
    this.messageSQ = (this.messageSQ + 1) % 256;
    buffer[8] = this.messageSQ;
    if(dataLength > 0)
        message.data.copy(buffer, 9, 0, dataLength);
    var checksum = 0;
    for(var i=0; i<length-1; i++)
        checksum ^= buffer[i];
    buffer[length-1] = checksum;
    if(this.serialPort) {
        this.serialPort.write(buffer);
        console.log("sent: " + dataUtils.hexString(buffer));
    }
    else
        console.log("could not send: " + dataUtils.hexString(buffer));
};

ZHAHost.prototype.onReceive = function(data) {
	console.log('received:')
	console.log(data);
	if(((rxBufferLen == 0) && (data[0] == 0xFE)) || (rxBufferLen > 0)) {
		data.copy(rxBuffer, 0, 0, data.length);
		rxBufferLen += data.length;
	}
	while(rxBufferLen >= messageLengthMin) {
		//console.log(`length of rx buffer: ${rxBufferLen}`);
		var rxMessageLen = rxBuffer[1];
		if(rxMessageLen > rxBufferLen)
			break;//message has not arrived completely
		if(rxMessageLen < messageLengthMin) {
			rxBufferLen = 0;
			console.log(`malformed message - length(${rxMessageLen}) field too short`);
			break;
		}
		console.log("parse rx message: " + dataUtils.hexString(rxBuffer.slice(0, rxMessageLen)));
		var rxMessage = new Message(rxBuffer[2], rxBuffer[3]);
		rxMessage.length = rxMessageLen;
		rxMessage.addrType = rxBuffer[4];
		rxMessage.nwkAddr = rxBuffer.readUInt16LE(5);
		rxMessage.endpoint = rxBuffer[7];
		rxMessage.messageSQ = rxBuffer[8];
		var dataLength = rxMessageLen - messageLengthMin;
		if(dataLength > 0) {
			rxMessage.data = new Buffer(dataLength);
			rxBuffer.copy(rxMessage.data, 0, 9, 9 + dataLength);
		}
		var commandId = rxMessage.command & 0x3F;
        var isAck = ((rxMessage.command & 0x40) == 0x40);
        var isResponse = ((rxMessage.command & 0x80) == 0x80);
		var command = null;
        var commandKey = null;
		for(var categoryKey in commands) {
			var category = commands[categoryKey];
			for(var iCommandKey in category) {
				var iCommand = category[iCommandKey];
				if(iCommand.layer != rxMessage.layer)
					break;//not this category
				if(iCommand.id == commandId) {
					command = iCommand;
                    commandKey = iCommandKey;
					break;//found command
				}
			}
			if(command)
				break;//found command
		}
		if(command) {
            var feedback = isAck ? "Ack" : (isResponse ? "Response" : null);
            if(feedback) {
                console.log("got " + feedback + " for command: " + commandKey);
                var feedbackData = isAck ? command.data.ack : command.data.response;
                if(feedbackData) {
                    var dataObject = this.parseCommandData(feedbackData, rxMessage.data);
                    console.log(dataObject);
                    rxMessage.dataObject = dataObject;
                    // The response will be xxxAck or xxxResponse
                    this.emit(commandKey + feedback, rxMessage);
                }
            }
			if(rxBufferLen == rxMessageLen) {
				rxBufferLen = 0;
				break;//no more data to process
			}
		}
		else
			console.log(`no command found of ${rxMessage.layer}.${rxMessage.command}`);
		rxBuffer.copy(rxBuffer, 0, rxMessageLen);
		rxBufferLen -= rxMessageLen;
	}
};

ZHAHost.prototype.parseCommandData = function(dataStruct, buffer) {
    var data = new Object();
    var dataOffset = 0;
    for(dataKey in dataStruct) {
        var dataLength = dataStruct[dataKey];
        if(dataLength == -1)
            dataLength = buffer.length - dataOffset;
        else if(dataLength + dataOffset > buffer.length)
            break;
        if(dataLength == 1)
            data[dataKey] = buffer[dataOffset];
        else if(dataLength == 2)
            data[dataKey] = buffer.readUInt16LE(dataOffset);
        else {
            var dataBuffer = new Buffer(dataLength);
            buffer.copy(dataBuffer, 0, dataOffset, dataOffset + dataLength);
            data[dataKey] = dataBuffer;
        }
        dataOffset += dataLength;
    }
    return data;
}

ZHAHost.prototype.makeCommandData = function(dataStruct, param) {
    var dataLength = 0;
    for(var dataKey in dataStruct) {
        var dataField = dataStruct[dataKey];
        dataLength += dataField.length;
    }
    var dataBuffer = new Buffer(dataLength);
    dataBuffer.fill(0);
    var dataOffset = 0;
    for(var dataKey in dataStruct) {
        // console.log("dataKey: " + dataKey);
        var dataField = dataStruct[dataKey];
        // if(dataField.values)
        //     console.log("dataValues: " + JSON.stringify(dataField.values));
        // either 'value' or 'values' is defined
        var dataValue = dataField.value;//使用预定义的固定值
        if(dataValue == null) {
            var paramValue = param[dataKey];//使用参数中提供的值
            if(paramValue != null) {
                // console.log("paramValue: " + paramValue);
                if((dataField.values) && (typeof paramValue == "string"))//如果预定义了可选值列表，参数值作为可选值的键
                    dataValue = dataField.values[paramValue];
                else//直接使用参数值
                    dataValue = paramValue;
            }
            assert((dataValue != null), "dataValue for " + dataKey + " is null!");
        }
        var dataFieldLength = dataField.length;
        if(dataFieldLength == 1)
            dataBuffer[dataOffset] = dataValue;
        else if(dataFieldLength == 2)
            dataBuffer.writeUInt16LE(dataValue, dataOffset);
        else {
            if(typeof dataValue == "string")
                dataValue = new Buffer(dataValue, "hex");
            assert(dataValue instanceof Buffer, "value for " + dataKey + " is not a buffer");
            assert(dataValue.length >= dataFieldLength, `value length(${dataValue.length}) is too short for ${dataKey}(${dataFieldLength})`);
            dataValue.copy(dataBuffer, 0, dataOffset, dataOffset+dataFieldLength);
        }
        dataOffset += dataFieldLength;
    }
    return dataBuffer;
}

//zha application

ZHAHost.prototype.onInit = function() {
    //this.onCommand(commands.system.getVersion);
    this.onCommand(commands.system.networkParam, {
        operation: 'read',
        configuration: 'epid'
    });
};

ZHAHost.prototype.loadDevices = function(devices) {
    if(devices) {
        this.lights = new Array();
        for(var device of devices) {
            var light = new ZHALight(device.id, device.uid);
            this.lights.push(light);
            this.onCommand(commands.network.getNwkAddrByMac, {
                macAddr: light.macAddr
            });
        }
    }
};

ZHAHost.prototype.updateNetworkParam = function(param) {
    if(this.networkParam == null)
        this.networkParam = new Object();
    for(var paramKey in param) {
        var paramValue = param[paramKey];
        this.networkParam[paramKey] = paramValue;
        if(paramValue instanceof Buffer)
            paramValue = paramValue.toString("hex").toUpperCase();
        this.emit(paramKey + "Updated", paramValue);
    }
    // console.log("network param updated:");
    // console.log(this.networkParam);
}

ZHAHost.prototype.getLight = function(key, value) {
    if(this.lights) {
        for(var light of this.lights) {
            if(key == 'macAddr') {
                if(light.macAddr.equals(value))
                    return light;
            }
            else if(light[key] == value)
                return light;
        }
    }
    return null;
};

ZHAHost.prototype.updateLightNwkAddr = function(macAddr, nwkAddr) {
    var light = this.getLight('macAddr', macAddr);
    if(light)
        console.log('got nwkAddr: ' + nwkAddr.toString(16) + ' of ' + light.id);
    else {
        var lastIndex = 0;
        if(this.lights) {
            if(this.lights.length > 0) {
                var lastLight = this.lights[this.lights.length-1];
                var lastId = lastLight.id;
                lastIndex = parseInt(lastId.slice(5));
            }
        }
        light = new ZHALight("Light" + (lastIndex+1).toString());
        light.macAddr = macAddr;
        light.uid = macAddr.toString("hex").toUpperCase();
        if(this.lights == null)
            this.lights = new Array();
        this.lights.push(light);
        this.emit("foundNewLight", light);
    }
    light.nwkAddr = nwkAddr;
    this.onCommand(commands.light.getPower, {'nwkAddr': nwkAddr});
};

exports.host = ZHAHost;
exports.light = ZHALight;
