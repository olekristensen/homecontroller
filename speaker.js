const MediaRendererClient = require('upnp-mediarenderer-client')
const util = require('util')
const parseString = require('xml2js').parseString;

class Speaker {
	constructor(url, name) {
		this.client = new MediaRendererClient(url)
		this.name = name;
		this.status = {};
		this.client.on('status', function (status) {
			// Reports the full state of the AVTransport service the first time it fires,
			// then reports diffs. Can be used to maintain a reliable copy of the
			// service internal state.
			console.log("status", status);
		});
		this.client.on('playing', function () {
			console.log('playing');
		});
	}

	async getStatus() {
		//TODO: update to use status reported from status callback
		this.status.transport = await this.getTransportInfo()
		this.status.media = await this.getMediaInfo()
		this.status.volume = await this.getVolume()
		//FIXME: only ask for wha when listed as service
		this.status.wha = await this.getWholeHomeAudioStatus()
		return {
			name: this.name,
			status: this.status
		}
	}

	async getSupportedProtocols() {
		const asyncGetSupportedProtocols = util.promisify(callback => {
			this.client.getSupportedProtocols(callback)
		})
		return await asyncGetSupportedProtocols();
	}

	async getTransportInfo() {
		const asyncGetTransportInfo = util.promisify(callback => {
			this.client.getTransportInfo(callback)
		})
		return await asyncGetTransportInfo();
	}

	async getVolume() {
		const asyncGetVolume = util.promisify(callback => {
			this.client.getVolume(callback)
		})
		return await asyncGetVolume();
	}

	async setVolume(vol) {
		const asyncSetVolume = util.promisify((vol, callback) => {
			this.client.setVolume(vol, callback)
		})
		//FIXME: why is volume crashing when in WHA?
		if (await asyncSetVolume(vol)) {
			return vol
		}
	}

	async getMute() {
		const asyncGetMute = util.promisify(callback => {
			this.client.getMute(callback)
		})
		return await asyncGetMute();
	}

	async setMute(mute) {
		const asyncSetMute = util.promisify((mute, callback) => {
			this.client.setMute(mute, callback)
		})
		if (await asyncSetMute(mute)) {
			return await this.getMute();
		}
	}

	async getMediaInfo() {
		const asyncGetMediaInfo = util.promisify(callback => {
			this.client.getMediaInfo(callback)
		})
		const mediaInfo = await asyncGetMediaInfo();
		const asyncParse = util.promisify((xml, callback) => {
			parseString(xml, callback)
		})
		const CurrentURIMetaData = await asyncParse(mediaInfo.CurrentURIMetaData)
		if (CurrentURIMetaData) mediaInfo.CurrentURIMetaData = CurrentURIMetaData["DIDL-Lite"].item;
		return mediaInfo;
	}

	async load(url, options) {
		const asyncLoad = util.promisify((url, options, callback) => {
			this.client.load(url, options, callback)
		})
		const result = await asyncLoad(url, options);
		return await this.getStatus();
	}

	async stop() {
		this.client.stop()
		return await this.getStatus()
	}

	async play() {
		this.client.play()
		return await this.getStatus()
	}

	async pause() {
		this.client.pause()
		return await this.getStatus()
	}

	async getWholeHomeAudioStatus() {
		const asyncFunc = util.promisify(callback => {
			this.client.callAction('urn:schemas-smsc-com:serviceId:X_WholeHomeAudio:1', 'GetDeviceStatusInfo', {}, function (err, result) {
				if (err) return callback(err);
				callback(null, result);
			});
		})
		const result = await asyncFunc();
		return result
	}

	async wholeHomeAudioCreateParty() {
		const asyncFunc = util.promisify(callback => {
			this.client.callAction('urn:schemas-smsc-com:serviceId:X_WholeHomeAudio:1', 'CreateParty', {}, function (err, result) {
				if (err) return callback(err);
				callback(null, result);
			});
		})
		const result = await asyncFunc();
		return result
	}

	async wholeHomeAudioLeaveParty() {
		const asyncFunc = util.promisify(callback => {
			this.client.callAction('urn:schemas-smsc-com:serviceId:X_WholeHomeAudio:1', 'LeaveParty', {}, function (err, result) {
				if (err) return callback(err);
				callback(null, result);
			});
		})
		const result = await asyncFunc();
		return result
	}

	async wholeHomeAudioJoinParty(party) {
		const asyncFunc = util.promisify((partyID, callback) => {
			this.client.callAction('urn:schemas-smsc-com:serviceId:X_WholeHomeAudio:1', 'JoinParty', {
				"PartyId": partyID
			}, function (err, result) {
				if (err) return callback(err);
				callback(null, result);
			});
		})
		const result = await asyncFunc(party);
		return result
	}
}

module.exports = Speaker
