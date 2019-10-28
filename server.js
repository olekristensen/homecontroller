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
	return me.speakers[name].getSupportedProtocols()
})

fastify.get('/speaker/:name/stop', async (request, reply) => {
	const name = request.params.name
	return me.speakers[name].stop()
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
	const url = Object.keys(me.streams).includes(request.query.name) ? me.streams[request.query.name].url : request.query.url
	const name = request.params.name
	const options = {
		autoplay: true,
		contentType: 'audio',
		metadata: {
			title: 'Ole Tester',
			creator: 'Ole Kristensen',
			type: 'audio', // can be 'video', 'audio' or 'image'
		}
	}
	return me.speakers[name].load(url, options)
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
