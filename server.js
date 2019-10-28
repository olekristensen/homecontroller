const parseString = require('xml2js').parseString;
const axios = require('axios')
const util = require('util')

const Speaker = require('./speaker')

const fastify = require('fastify')({
	logger: true
})

this.streams = {
	'DR P1': {
		url: 'http://live-icy.gss.dr.dk/A/A03H.mp3'
	},
	'DR P2': {
		url: 'http://live-icy.gss.dr.dk/A/A04H.mp3'
	},
	'DR P8': {
		url: 'http://live-icy.gss.dr.dk/A/A22H.mp3'
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
		me.speakers[speakerName] = new Speaker(headers.LOCATION, speakerName)
		console.log("Speaker added", speakerName)
	}
	/*
    console.log(result.root.device[0].friendlyName[0], util.inspect(result.root.device, {
		showHidden: false,
		depth: 3
	}))
    */
})

// Get a list of all services on the network
ssdpClient.search('urn:schemas-upnp-org:device:MediaRenderer:1');

//ssdpClient.search('ssdp:all');

fastify.get('/speaker/:name/protocols', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getSupportedProtocols()
})

fastify.get('/speaker/:name/transportInfo', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getTransportInfo()
})

fastify.get('/speaker/:name/wha', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getWholeHomeAudioStatus()
})

fastify.get('/speaker/:name/wha/create', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].wholeHomeAudioCreateParty()
})

fastify.get('/speaker/:name/wha/join', {
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

fastify.get('/speaker/:name/wha/leave', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].wholeHomeAudioLeaveParty()
})

fastify.get('/speaker', async (request, reply) => {
	return Object.keys(me.speakers)
})

fastify.get('/speaker/:name', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].getStatus()
})

fastify.get('/speaker/:name/stop', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].stop()
})

fastify.get('/speaker/:name/play', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].play()
})

fastify.get('/speaker/:name/pause', async (request, reply) => {
	const name = request.params.name
	return await me.speakers[name].pause()
})

fastify.get('/speaker/:name/load', {
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
	const stream = Object.keys(me.streams).includes(request.query.name) ? me.streams[request.query.name].url : undefined
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

fastify.get('/speaker/:name/volume', {
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
	if(v){
		return await me.speakers[name].setVolume(v)
	} else {
		return await me.speakers[name].getVolume()
	}
})

const start = async () => {
	try {
		await fastify.listen(3000)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}
start()
