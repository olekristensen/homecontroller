const parseString = require('xml2js').parseString;
const axios = require('axios')
const util = require('util')

const Speaker = require('./speaker')

const fastify = require('fastify')({
	logger: true,
	http2: false
})

fastify.register(require("point-of-view"), {
	engine: {
		marko: require("marko")
	}
})

//TODO: Add channel logos and titles
this.settings = {
	streams: {
		'DR P1': {
			url: 'http://live-icy.gss.dr.dk/A/A03H.mp3'
		},
		'DR P2': {
			url: 'http://live-icy.gss.dr.dk/A/A04H.mp3'
		},
		'DR P8': {
			url: 'http://live-icy.gss.dr.dk/A/A22H.mp3',
			default: true
		},
		'VRT Radio 1': {
			url: 'http://icecast.vrtcdn.be/radio1-high.mp3'
		},
		'VRT Klara': {
			url: 'http://icecast.vrtcdn.be/klara-high.mp3'
		},
		'VRT Klara Continuo': {
			url: 'http://icecast.vrtcdn.be/klaracontinuo-high.mp3'
		},
		'VRT Studio Brussel': {
			url: 'http://icecast.vrtcdn.be/stubru-high.mp3'
		}
	},
	speakers: {
		'Soveværelse': {
			main: false,
			silentHours: [{
				from: 19,
				to: 24
			}, {
				from: 0,
				to: 9
			}],
			defaultVolume: 6
		},
		"Stue": {
			main: true,
			defaultVolume: 10
		},
		"Køkken": {
			main:false,
			defaultVolume: 6
		}
	}
}

this.speakers = {}

const me = this

// SEARCH FOR SPEAKERS

const SsdpClient = require('node-ssdp').Client
const ssdpClient = new SsdpClient()

ssdpClient.on('response', async function (headers, statusCode, rinfo) {

	//console.log('Got a response to an m-search.', headers);

	const descriptionXML = await axios.get(headers.LOCATION)

	const asyncParse = util.promisify((descriptionXML, callback) => {
		parseString(descriptionXML.data, callback)
	})
	const description = await asyncParse(descriptionXML)

	const speakerName = description.root.device[0].friendlyName[0]

	if (!me.speakers[speakerName]) {
		if(description.root.device[0].manufacturer.includes('clintdigital.com')){
			me.speakers[speakerName] = new Speaker(headers.LOCATION, speakerName)
		}
		console.log("Speaker added", speakerName, headers.LOCATION)
		console.log(description.root.device[0].friendlyName[0] + " device description", util.inspect(description.root.device, {
			showHidden: false,
			depth: 10
		}))
	}
    
})

// Get a list of all services on the network
ssdpClient.search('urn:schemas-upnp-org:device:MediaRenderer:1');

//ssdpClient.search('ssdp:all');

fastify.get('/api/speaker', async (request, reply) => {
	return Object.keys(me.speakers)
})

fastify.get('/api/speaker/:name', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getStatus()
})

fastify.get('/api/speaker/:name/stop', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].stop()
})

fastify.get('/api/speaker/:name/play', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].play()
})

fastify.get('/api/speaker/:name/pause', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].pause()
})

fastify.get('/api/speaker/:name/load', {
	schema: {
		querystring: {
			url: {
				type: 'string'
			},
			name: {
				type: 'string'
			}
		}
	}
}, async (request, reply) => {
	const stream = Object.keys(me.settings.streams).includes(request.query.name) ? me.settings.streams[request.query.name].url : undefined
	const url = stream || request.query.url
	const name = request.params.name
	const options = {
		autoplay: true,
		contentType: 'audio',
		metadata: {
			title: request.query.name,
			creator: 'Ole Kristensen',
			type: 'audio', // can be 'video', 'audio' or 'image'
		}
	}
	return await me.speakers[name].load(url, options)
})

fastify.get('/api/speaker/:name/volume', {
	schema: {
		querystring: {
			v: {
				type: 'integer'
			}
		}
	}
}, async (request, reply) => {
	const name = request.params.name
	const v = request.query.v
	if (v) {
		return await me.speakers[name].setVolume(v)
	} else {
		return await me.speakers[name].getVolume()
	}
})

fastify.get('/api/speaker/:name/protocols', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getSupportedProtocols()
})

fastify.get('/api/speaker/:name/transportInfo', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getTransportInfo()
})

fastify.get('/api/speaker/:name/wha', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getWholeHomeAudioStatus()
})

fastify.get('/api/speaker/:name/wha/create', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].wholeHomeAudioCreateParty()
})

fastify.get('/api/speaker/:name/wha/join', {
	schema: {
		querystring: {
			party: {
				type: 'string'
			}
		}
	}
}, async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].wholeHomeAudioJoinParty(request.query.party)
})

fastify.get('/api/speaker/:name/wha/leave', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].wholeHomeAudioLeaveParty()
})

fastify.get('/api/actions/next', async (request, reply) => {
	return await changeStream(1)
})

fastify.get('/api/actions/previous', async (request, reply) => {
	return await changeStream(-1)
})

fastify.get('/api/actions/up', async (request, reply) => {

	let activeSpeakerNames = getActiveSpeakerNames();
	let ret = {};

	await Promise.all(activeSpeakerNames.map( async s => {
		let volume = await me.speakers[s].getVolume();
		volume += 1;
		ret[s] = await me.speakers[s].setVolume(volume);
	}));

	return ret;
	
})

fastify.get('/api/actions/down', async (request, reply) => {
	let activeSpeakerNames = getActiveSpeakerNames();
	let ret = {};

	await Promise.all(activeSpeakerNames.map( async s => {
		let volume = await me.speakers[s].getVolume();
		volume = Math.max(volume-1, 0);
		ret[s] = await me.speakers[s].setVolume(volume);
	}));

	return ret;
})

fastify.get('/api/actions/play', async (request, reply) => {

	let allSpeakersStatus = await getAllSpeakersStatus();

	let streamNameToPlay = getCurrentlyPlayingStreamName(allSpeakersStatus);
	let mainSpeakerName = getMainSpeakerName();
	let activeSpeakerNames = getActiveSpeakerNames();

	let passiveSpeakerNames = getPassiveSpeakerNames()
	await Promise.all(passiveSpeakerNames.map(async s => {
		await me.speakers[s].wholeHomeAudioLeaveParty()
	}))

	//TODO: check if the party is already started, see if there's something else playing, and just load the new channel, and join missing speakers
	//      use getWhaMasterOrMainSpeakerName

	let party = await me.speakers[mainSpeakerName].wholeHomeAudioCreateParty()

	await Promise.all(activeSpeakerNames.map(async n => {
		await me.speakers[n].setVolume(me.settings.speakers[n].defaultVolume);
		await me.speakers[n].setMute(0);
		if (n != mainSpeakerName) {
			await me.speakers[n].wholeHomeAudioJoinParty(party.PartyId);
		}
	}))

	const options = {
		autoplay: true,
		contentType: 'audio',
		metadata: {
			title: streamNameToPlay,
			creator: 'Ole Kristensen',
			type: 'audio', // can be 'video', 'audio' or 'image'
		}
	}

	await me.speakers[mainSpeakerName].load(me.settings.streams[streamNameToPlay].url, options)

	return {
		activeSpeakerNames: activeSpeakerNames,
		streamNameToPlay: streamNameToPlay
	}

})

fastify.get('/api/actions/stop', async (request, reply) => {
	let allSpeakersStatus = await getAllSpeakersStatus()
	let speakerName = getWhaMasterOrMainSpeakerName(allSpeakersStatus)
	let speaker = me.speakers[speakerName]
	return await speaker.stop()
})


fastify.get("/api", (req, reply) => {
	reply.view("/index.marko");
});

function getCurrentlyPlayingStreamName(allSpeakersStatus) {
	let streamNameToPlay = getDefaultStreamName()
	let activeSpeakerNames = getActiveSpeakerNames();
	let activeSpeakersStatus = allSpeakersStatus.filter(s => activeSpeakerNames.includes(s.name));
	let playingSpeakerStatus = activeSpeakersStatus.filter(s => s.status.transport.CurrentTransportState === "PLAYING");
	let mainSpeakerName = getMainSpeakerName();
	let mainSpeakerStatus = allSpeakersStatus.filter(s => s.name === mainSpeakerName)[0];
	if (playingSpeakerStatus.length > 0) {
		playingSpeakerStatus.map(s => {
			streamNameToPlay = getStreamNameFromUrl(s.status.media.CurrentURI)
		});
		// let main speaker overwrite
		if (playingSpeakerStatus.map(s => s.name).includes(mainSpeakerName)) {
			streamNameToPlay = getStreamNameFromUrl(mainSpeakerStatus.status.media.CurrentURI)
		}
	}
	return streamNameToPlay;
}

function getMainSpeakerName() {
	return Object.keys(me.settings.speakers).filter(speakerName => {
		return me.settings.speakers[speakerName].main;
	})[0];
}

async function changeStream(offset) {
	let allSpeakersStatus = await getAllSpeakersStatus()
	let speakerName = getWhaMasterOrMainSpeakerName(allSpeakersStatus)
	let speaker = me.speakers[speakerName]
	let currentlyPlayingStreamName = getStreamNameFromUrl(speaker.status.media.CurrentURI)
	let streamNames = Object.keys(me.settings.streams)
	let nextIndex = mod((streamNames.indexOf(currentlyPlayingStreamName) + offset) ,streamNames.length)
	let nextStreamName = streamNames[nextIndex]
	const options = {
		autoplay: true,
		contentType: 'audio',
		metadata: {
			title: nextStreamName,
			creator: 'Ole Kristensen',
			type: 'audio', // can be 'video', 'audio' or 'image'
		}
	}
	await me.speakers[speakerName].load(me.settings.streams[nextStreamName].url, options)
	return {
		streamNameToPlay: nextStreamName
	}
}

function getWhaMasterOrMainSpeakerName(allSpeakersStatus) {
	let mainSpeakerName = getMainSpeakerName()
	let whaMasterSpeakers = allSpeakersStatus.filter(s => s.status.wha.DeviceStatus == '4')
	if (whaMasterSpeakers.length > 0) {
		if (whaMasterSpeakers.map(s => s.name).includes(mainSpeakerName))
			return mainSpeakerName
		else
			return whaMasterSpeakers[0].name
	} else {
		return mainSpeakerName
	}
}

function getStreamNameFromUrl(url) {
	if (Object.keys(me.settings.streams).map(k => {
			return me.settings.streams[k].url;
		}).includes(url)) {
		return Object.keys(me.settings.streams).filter(k => {
			return me.settings.streams[k].url === url;
		})[0];
	}
	return undefined
}

async function getAllSpeakersStatus() {
	return Promise.all(Object.keys(me.speakers).map(async (k) => {
		return await me.speakers[k].getStatus();
	}));
}

function getDefaultStreamName() {
	return Object.keys(me.settings.streams).filter(k => me.settings.streams[k].default)[0];
}

function getActiveSpeakerNames() {
	const date = new Date();
	let hours = date.getHours();
	// find names of active speakers
	let activeSpeakerNames = Object.keys(me.speakers).filter(k => {
		let setting = me.settings.speakers[k];
		let speaker = me.speakers[k];
		let speakerActive = true;
		if (setting && setting.silentHours) {
			setting.silentHours.map(h => {
				if (h.from && h.to) {
					//FIXME: DID NOT FIND MORNING HOURS
					console.log(h);
					if (hours >= h.from && hours < h.to) {
						speakerActive = false;
					}
				}
			});
		}
		return speakerActive;
	});
	return activeSpeakerNames;
}

function getPassiveSpeakerNames() {
	let activeSpeakerNames = getActiveSpeakerNames()
	let passiveSpeakerNames = Object.keys(me.speakers).filter(k => !activeSpeakerNames.includes(k))
	return passiveSpeakerNames
}

function mod(n, m) {
	return ((n % m) + m) % m;
}

const start = async () => {
	try {
		fastify.log.info("Starting server")
		await fastify.listen(3000, '0.0.0.0')
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}
start()
