async function routes(fastify, options) {
	const speaker = fastify.speaker
	const util = require('util')

	fastify.get('/', async (request, reply) => {
		return {
			hello: 'world'
		}
	})

	fastify.get('/protocols', async (request, reply) => {
		const asyncGetSupportedProtocols = util.promisify((callback) => {
			speaker.getSupportedProtocols(callback)
		})
		const result = await asyncGetSupportedProtocols();
		return result
	})

	fastify.get('/load', {
		schema: {
			querystring: {
				url: {
					type: 'string'
				},
			}
		}
	}, async (request, reply) => {
		const asyncLoad = util.promisify((url, options, callback) => {
			speaker.load(url, options, callback)
		})
		const options = {
			autoplay: true,
			contentType: 'audio',
			metadata: {
				title: 'Ole Tester',
				creator: 'Ole Kristensen',
				type: 'audio', // can be 'video', 'audio' or 'image'
			}
		};
		const result = await asyncLoad(request.query.url, options);
		if (result.value === null) {
			throw new Error('Invalid value')
		}
		return result
	})
}

module.exports = routes
