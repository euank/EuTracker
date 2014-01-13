var bencode = require('dht-bencode'),
    http = require('http'),
    url = require('url'),
    dconfig = require('./default_config');

/**
 * Indicates the status of a peer that is active with this tracker
 * @class PeerStatus
 * @static
 */
var PeerStatus = {
  /**
   * The peer has contacted the tracker and has not sent the 'complete' event or
   * indicated it has no download left. It has also not sent the 'stop' event.
   * @property STARTED
   * @type Enum
   */
  STARTED: 1,
  /**
   * The peer has sent the 'complete' event or has indicated it has nothing
   * left to download @property COMPLETED
   * @type Enum
   */
  COMPLETED: 2
};

/**
 * A peer that has contacted the tracker
 * @class Peer
 * @constructor
 *
 * @param {String} id The peerid
 * @param {String} ip The peer's ip
 * @param {Integer} port The peer's port
 */
function Peer(id, ip, port) {
  this.id = id;
  this.ip = ip;
  this.port = port;
  this.status = PeerStatus.STARTED;
  this.lastActive = new Date().getTime() / 1000;
  this.left = null;
  this.uploaded = 0;
  this.downloaded = 0;

  /**
   * The peer has completed downloading this torrent
   * @method setCompleted
   */
  this.setCompleted = function() {
    this.left = 0;
    this.status = PeerStatus.COMPLETED;
  };
  /**
   * Update upload and download amounts as reported by the peer
   * @method updateUpDown
   * @param {Integer} up Amount of data uploaded for this peer+torrent
   * @param {Integer} down Amount of data downloaded for this peer+torrent
   * @param {Integer} left Amount of data left for this peer+torrent
   * @return 
   */
  this.updateUpDown = function(up, down, left) {
    this.uploaded += up;
    this.downloaded += down;
    this.left = left;
    if(left === 0) this.setCompleted();
  };
}

/**
 * Created when a peer contacts the tracker about a torrent it has not seen
 * before. Contains all data about that torrent
 * @class Torrent
 * @constructor
 * @param {String} tid The torrent's infohash
 * @param {} config The tracker config object
 */
function Torrent(tid, config) {
  this.tid = tid;
  this.peers = [];
  /**
   * Add a new peer to the torrent
   * @method addPeer
   * @param {Peer} peer 
   */
  this.addPeer = function(peer) {
    this.peers.push(peer);
  };
  /**
   * Returns a peer given the peerid
   * @method getPeer
   * @param {String} peerid The peerid to search for
   * @return Literal Peer or null if there is none
   */
  this.getPeer = function(peerid) {
    for(var i=0;i<this.peers.length;i++) {
      if(this.peers[i].id == peerid) return this.peers[i];
    }
    return null;
  };
  /**
   * Remove a given peer
   * @method rmPeer
   * @param {Peer} peer The peer to remove
   */
  this.rmPeer = function(peer) {
    this.peers.splice(this.peers.indexOf(peer), 1);
  };

  /**
   * Delete all peers that have not been active recently enough
   * @method cleanPeers
   */
  this.cleanPeers = function() {
    var peer,
        now = new Date().getTime() / 1000;

    for(var i=0;i<this.peers.length;i++) {
      peer = this.peers[i];
      if((now - peer.lastActive) >= (config.peerCleanTime * 60)) {
        this.rmPeer(peer);
      }
    }
  };

  /**
   * Get all peers at 100% for this torrent
   * @method getSeeds
   * @param {Peer} not_this_peer A single peer to exclude from this list
   * @return peers An array of peers
   */
  this.getSeeds = function(not_this_peer) {
    var ret = [];
    for(var i=0;i<this.peers.length;i++) {
      if(this.peers[i].status == PeerStatus.COMPLETED && this.peers[i] != not_this_peer) {
        ret.push(this.peers[i]);
      }
    }
    return ret;
  };

  /**
   * Get all peers not at 100% for this torrent
   * @method getLeechers
   * @param {Peer} not_this_peer A single peer to exclude from this list
   * @return peers An array of peers
   */
  this.getLeechers = function(not_this_peer) {
    var ret = [];
    for(var i=0;i<this.peers.length;i++) {
      if(this.peers[i].status != PeerStatus.COMPLETED && this.peers[i] != not_this_peer) {
        ret.push(this.peers[i]);
      }
    }
    return ret;
  };

  /**
   * Get a list of peers for a leecher. The main goal of a peer
   * announcing is to get this list.
   * @method getLeecherPeers
   * @param {Peer} peer The peer requesting peers
   * @param {Integer} numwant Howm any peers the leecher
   * desires.
   * @return peers An array of peers
   */
  this.getLeecherPeers = function(peer, numwant) {
    /* Goal here is to return good peers for downloaders.  They
     * should contain many seeders and should not contain the
     * peer requesting em.  Using random here. If the client has
     * an issue with one of the returned peers then it should
     * request more or otherwise resolve it itself. Tracker
     * could calculate quite a bit of info, but it still doesn't
     * really feel like the right place to implement that sort
     * of thing.
     */
    var ret = [];

    var seeds = this.getSeeds(peer); //returns a copy so we can destructively select from it
    while(seeds.length > 0 && ret.length <= numwant) {
      ret.push(seeds.splice(Math.floor(Math.random() * seeds.length), 1)[0]);
    }

    var leeches = this.getLeechers(peer);
    while(leeches.length > 0 && ret.length <= numwant) {
      var aleech = leeches.splice(Math.floor(Math.random() * leeches.length), 1)[0];
      ret.push(aleech);
    }
    return ret;
  };

  //TODO, actually test this at all
  /**
   * Get an uncompact response to an announce
   * @method uncompactResponse
   * @param {Peer} peer The peer requesting a response
   * @param {Integer} numwant How many peers they want
   * @return bresp Bencoded response
   */
  this.uncompactResponse = function(peer, numwant) {
    var rpeers = this.getLeecherPeers(peer, numwant);
    var ret = {
      interval: config.announceTime * 60,
      'tracker id': config.trackerId,
      complete: this.getSeeds().length,
      incomplete: this.getLeechers().length
    };

    var retPeers = [];
    for(var i=0;i<rpeers.length;i++) {
      retPeers.push({
        'peer id': p,
        ip: peers[p].ip,
        port: peers[p].port
      });
    }
    ret.peers = retPeers;
    var bresp = bencode.bencode(ret).toString();
    return bresp;
  };

  /**
   * Get a compact response to an announce.
   * @method compactResponse
   * @param {Peer} peer The peer requesting a response
   * @param {Integer} numwant How many peers they want
   * @return bresp Bencoded response
   */
  this.compactResponse = function(peer, numwant) {
    var i,j;
    var rpeers = this.getLeecherPeers(peer, numwant);
    var ret = {
      interval: config.announceTime * 60,
      'tracker id': config.trackerId,
      complete: this.getSeeds().length,
      incomplete: this.getLeechers().length
    };

    var peerhex = "";
    for(i=0;i<rpeers.length; i++) {
      var s;
      var p = rpeers[i];
      var ip_parts = p.ip.split('.');
      for(j=0;j<4;j++) {
        s = parseInt(ip_parts[j]).toString(16);
        if(s.length == 1) peerhex+= "0";
        peerhex += s;
      }
      s = p.port.toString(16);

      //Pad it to the right length .. 1 becomes 0001, FF becomes 00FF
      for(j=0;j<(4-s.length);j++) { 
        peerhex+='0';
      }
      peerhex += s;
    }
    ret.peers = new Buffer(peerhex, 'hex');

    var bresp = bencode.bencode(ret);
    return bresp;
  };
}




/**
 * This contains a list of torrents and provides functions to
 * handle requests
 * @class Tracker
 * @constructor
 * @param {Object} config Tracker configuration
 */
var Tracker = function(config) {
  var TrackerObj = this;
  TrackerObj.config = config || dconfig;
  TrackerObj.torrents = [];

  /**
   * Get a torrent by infohash
   * @method getTorrent
   * @param {String} infohash The torrent's infohash
   * @return torrent The torrent if found, null if not
   */
  TrackerObj.getTorrent = function(infohash) {
    for(var i=0;i<TrackerObj.torrents.length;i++) {
      if(TrackerObj.torrents[i].tid == infohash) return TrackerObj.torrents[i];
    }
    return null;
  };

  /**
   * Handle a scrape request to the tracker
   * @method handleScrape
   * @param {http.ServerRequest} req A node http request
   * @param {http.ServerResponse} res A node http response
   */
  TrackerObj.handleScrape = function(req, res) {
    var u = url.parse(req.url,true);
    var qs = u.query;
    var hashes = qs.info_hash;

    if(typeof hashes == 'string') {
      //If they only gave one info hash. We want to handle arrays of them
      hashes = [hashes];
    }

    var files = {};

    for(var i=0;i<hashes.length;i++) {
      var hash = hashes[i];
      var tor = TrackerObj.getTorrent(hash);
      if(tor !== null) {
        files[hash] = {
          complete: tor.getSeeds().length,
          downloaded: 0, //TODO, support total downloads
          incomplete: tor.getLeechers().length
        };
      }
      if(tor.name) {
        /* TODO, make TrackerObj possible. TrackerObj can't work without the tracker having
         * some form of access to the torrent files. The scenario here would be 
         * a website hosting the torrent files and then the website parses the
         * name out. The website provides some internal api that TrackerObj tracker
         * requests a name / etc on whenever a new hash is announced. TrackerObj would
         * also allow an external system to manage allowed / not allowed torrents.
         *
         * Of course, TrackerObj has been solved in the past (xbtt) by sharing a database,
         * but TrackerObj is a bad solution. 
         *
         * Ideally, TrackerObj software would provide an api for whitelist / name infohash.
         * That can be one of the longterm features I guess? For now that's not happening.
         */
        files[hash].name = tor.name;
      }
    }
    res.end(bencode.bencode({files: files}));
  };

  /**
   * Handle an announce request to the tracker
   * @method handleAnnounce
   * @param {http.ServerRequest} req A node http request
   * @param {http.ServerResponse} res A node http response
   */
  TrackerObj.handleAnnounce = function(req, res) {
    var u = url.parse(req.url,true);
    var qs = u.query;
    var tor = qs.info_hash,
        peer_id = qs.peer_id,
        port = parseInt(qs.port),
        uploaded = parseInt(qs.uploaded),
        downloaded = parseInt(qs.downloade),
        left = parseInt(qs.left),
        no_peer_id = (qs.no_peer_id),
        ip = qs.ip,
        compact = qs.compact,
        ev = qs.event;
        numwant = qs.numwant || 30;

    if(!tor) return res.end(bencode.bencode({error: "Malformed request; no info hash"}).toString());
    if(!peer_id) return res.end(bencode.bencode({error: "Malformed request; no peer_id"}).toString());
    if(!port || port < 0 || port > 65535) return res.end(bencode.bencode({error: "Malformed request; Invalid port"}).toString());
    if(!ip) ip = req.connection.remoteAddress;

    var torrent = TrackerObj.getTorrent(tor);
    if(!torrent) {
      torrent = new Torrent(tor, config);
      TrackerObj.torrents.push(torrent);
    }

    var peer = torrent.getPeer(peer_id);
    if(!peer) {
      peer = new Peer(peer_id, ip, port);
      torrent.addPeer(peer);
    }


    switch(ev) {
      case "stopped":
        torrent.rmPeer(peer);
        break;
      case "completed":
        peer.setCompleted();
        /* falls through */
      default:
        peer.updateUpDown(uploaded, downloaded, left);
        break;
    }

    if(compact == "0") res.end(torrent.uncompactResponse(peer, numwant));
    else res.end(torrent.compactResponse(peer, numwant));
    console.log(TrackerObj.torrents);
  };

  /**
   * Start the tracker serving with the constructor config
   * @method start
   */
  TrackerObj.start = function() {
    http.createServer(function(req,res) {
      var u = url.parse(req.url,true);

      if(u.pathname == config.announceUrl) {
        TrackerObj.handleAnnounce(req, res);
      } else if(u.pathname == config.scrapeUrl) {
        TrackerObj.handleScrape(req, res);
      } else {
        res.end("No dice, think about <a href='"+(config.announceUrl)+"'>announce</a>");
      }
    }).listen(config.port);
  };
};

module.exports = Tracker;
