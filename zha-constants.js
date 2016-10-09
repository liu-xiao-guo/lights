var addrTypes = {
	multicast: 1,
	nwkUnicast: 2,
	macUnicast: 3,
	broadcast: 0x0f,
}

var commandStatus = {
	ok: 0,
	fail: 1
}

var lightingPower = {
	off: 0,
	on: 1,
	toggle: 2
}

var networkOperations = {
    read: 0,
    write: 1
}

var networkConfigurations = {
    channel: 1,
    epid: 3
}

var commands =  {
	system: {
		networkSet: {layer: 1, id: 0, data: {
            response: {
                hardwarePlatform: 1,
                major: 1,
                minor: 1
            }
        }},
		getVersion: {layer: 1, id: 1, data: {
            ack: {
                hardwarePlatform: 1,
                major: 1,
                minor: 1
            }
        }},
		reset: {layer: 1, id: 2},
		restore: {layer: 1, id: 3, data: {
            send: {
                configuration: {length: 1, value: 0x03}
            }
        }},
		networkParam: {layer: 1, id: 4, data: {
            send: {
                operation: {length: 1, values: networkOperations},
                configuration: {length: 1, values: networkConfigurations}
            },
            ack: {
                operation: 1,
                configuration: 1,
                status: 1,
                value: -1
            }
        }}
	},
	network: {
		switchNetwork: {layer: 2, id: 1, data: {
            send: {duration: {length:1, values:{off: 0, on:0xff}}},
            ack: {status: 1}
        }},
		updateAddress: {layer: 2, id: 2, data: {
            response: {nwkAddr: 2, macAddr: 8, deviceType: 1}
        }},
        //getEndpoints: {layer: 2, id: 3},
		getNwkAddrByMac: {layer: 2, id: 5, data: {
            send: {
                macAddr: {length: 8},
                requestType: {length: 1, value: 0},
                startIndex: {length: 1, value: 0}
            },
            response: {
                status: 1,
                macAddr: 8
            }
        }},
		getMacAddrByNwk: {layer: 2, id: 6, data: {
            send: {
                requestType: {length:1, value: 0},
                startIndex: {length:1, value: 0}
            },
            response: {
                status: 1,
                macAddr: 8
            }
        }},
        detached: {layer: 2, id: 21, data: {
            response: {
                status: 1,
                macAddr: 8
            }
        }},
        detachDevice: {layer: 2, id: 22, data: {
            send: {
                macAddr: {length: 8}
            }
        }}
	},
	ha: {
		//getEndpointInfo: {layer: 4, id: 0x01},
		// restore: {layer: 4, id: 2, data: {
        //     response: {
        //         status: 1
        //     }
        // }},
		blink: {layer: 4, id: 3, data: {
            send: {
                time: {length: 1}
            },
            response: {
                status: 1
            }
        }},
		// addGroup: {layer: 4, id: 0x04},
		// removeGroup: {layer: 4, id: 0x05},
		// clearGroups: {layer: 4, id: 0x06},
		// getGroup: {layer: 4, id: 0x07},
		// getSceneCount: {layer: 4, id: 0x08},
		// getSceneStatus: {layer: 4, id: 0x09},
		// saveScene: {layer: 4, id: 0x0A},
		// callScene: {layer: 4, id: 0x0B},
		// removeScene: {layer: 4, id: 0x0C},
		// clearScenes: {layer: 4, id: 0x0D},
		// getScene: {layer: 4, id: 0x0E}
	},
	light: {
		power: {layer: 5, id: 1, data: {
            send: {
                operation: {length: 1, values: lightingPower}
            }
        }},
		lum: {layer: 5, id: 2, data: {
            send: {
                operation: {length: 1, value: 0x04},
                lum: {length: 1},
                duration: {length: 2}
            }
        }},
		hueSaturation: {layer: 5, id: 3, data: {
            send: {
                operation: {length: 1, value: 0x07},
                hue: {length: 1},
                saturation: {length: 1},
                duration: {length: 2}
            }
        }},
		colorTemperature: {layer: 5, id: 4, data: {
            send: {
                colorTemperature: {length: 2},
                duration: {length: 2}
            }
        }},
		getPower: {layer: 5, id: 5, data: {
            send: {
                propertyId: {length: 2, value: 0}
            },
            response: {
                status: 1,
                power: 1
            }
        }},
		getLum: {layer: 5, id: 6, data: {
            send: {
                propertyId: {length: 2, value: 0}
            },
            response: {
                status: 1,
                lum: 1
            }
        }},
		getHueSaturation: {layer: 5, id: 7, data: {
            send: {
                propertyId: {length: 2, vlaue: 0}
            },
            response: {
                status: 1,
                hue: 1,
                saturation: 1
            }
        }},
		getColorTemperature: {layer: 5, id: 8, data: {
            send: {
                propertyId: {length: 2, vlaue: 0}
            },
            response: {
                status: 1,
                colorTemperature: 2
            }
        }}
	}
};

// var lightingEndpoint = 0xb;

// var nwkAddrAll = 0xffff;

module.exports = {
    'commands': commands,
    'addrTypes': addrTypes,
    'commandStatus': commandStatus,
    'networkOperations': networkOperations,
    'networkConfigurations': networkConfigurations,
    'lightingPower': lightingPower,
    // 'lihgtingEndpoint': lightingEndpoint,
    // 'nwkAddrAll': nwkAddrAll
    'lightingEndpoint': 0x0b,
    'nwkAddrAll': 0xffff
}