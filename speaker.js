const MediaRendererClient = require('upnp-mediarenderer-client')
const util = require('util')

class Speaker {
	constructor(url, name) {
		this.client = new MediaRendererClient(url)
		this.name = name;
		this.status = {
			"name": this.name,
			"state": "new"
		}
		this.client.on('status', function (status) {
			// Reports the full state of the AVTransport service the first time it fires,
			// then reports diffs. Can be used to maintain a reliable copy of the
			// service internal state.
			console.log(status);
		});
		this.client.on('playing', function () {
			console.log('playing');

			this.client.getPosition(function (err, position) {
				console.log(position); // Current position in seconds
			});

			this.client.getDuration(function (err, duration) {
				console.log(duration); // Media duration in seconds
			});
		});
	}

	async getSupportedProtocols() {
		const asyncGetSupportedProtocols = util.promisify(callback => {
			this.client.getSupportedProtocols(callback)
		})
		return await asyncGetSupportedProtocols();
	}

  async load(url, options){
    const asyncLoad = util.promisify((url, options, callback) => {
      this.client.load(url, options, callback)
    })
    const result = await asyncLoad(url, options);  
    return await asyncLoad(url, options);  
  }

	stop() {
    this.client.stop()
    this.status.state = "stopped"
		return this.status
	}

}

module.exports = Speaker
