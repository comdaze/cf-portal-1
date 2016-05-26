process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; //Disables HTTPS / SSL / TLS checking across entire node.js environment.

var Pumpkin = require('nodejs-pumpkin');
var CFClient = require('../../lib/CFClient');
var nodemailer = require('nodemailer');

//_config = require('../../../../config.json');

var pumpkin = new Pumpkin();
pumpkin.addWork('login', function(params)
{
	this.data.client.setUserInfo(params.username, params.password);
	this.data.client.login(function()
	{
		this.next();
	}.bind(this), function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('getUsers', function(params)
{
	this.data.client.getUsers(function(result)
	{
		this.next(result);
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('getUser', function(params)
{
	this.data.client.getUser(params.username, function(result)
	{
		if(result && result.resources.length == 1)
			this.next({userId : result.resources[0].id});
		else
			this.error(result);
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('createUser', function(params)
{
	this.data.client.createUser(params.username, params.password, function(result)
	{
		if(result.error)
		{
			this.error(result.message);
		}
		else
		{
			this.data.userId = result.id;
			this.next(result);	
		}
		
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteUser', function(params)
{
	this.data.client.deleteUser(params.userId, function(result)
	{
		this.next();
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('getOrg', function(user)
{
	this.data.client.request('/v2/organizations?q=user_guid:' + user.id, 'GET', null, null, function(data)
	{
		this.next();
	}, function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('getQuotaByName', function(params)
{
	this.data.client.request('/v2/quota_definitions', 'GET', null, null, function(data)
	{
		if(data && data.resources)
		{
			var quota = null;
			var list = data.resources;
			for(var i=0; i<list.length; i++)
			{
				if(list[i].entity.name == params.name)
				{
					quota = list[i];
					break;
				}
			}
			
			this.next(quota);
		}
		else
		{
			this.error(data);
		}
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('createOrg', function(params)
{
	this.data.client.request('/v2/organizations', 'POST', null, {name : params.name, quota_definition_guid : params.metadata.guid}, function(data)
	{
		if(data)
		{
			if(data.entity)
			{
				this.data.orgId = data.metadata.guid;
				this.next({orgId : data.metadata.guid});
			}
			else
			{
				if(data.code == 30002)
				{
					this.data.client.request('/v2/organizations', 'POST', null, {name : params.name + '2', quota_definition_guid : params.metadata.guid}, function(data)
					{
						if(data.entity)
						{
							this.data.orgId = data.metadata.guid;
							this.next({orgId : data.metadata.guid});
						}
						else
						{
							this.error(data);
						}
							
					}.bind(this));
				}
				else
				{
					this.error(data);
				}
			}
		}
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteOrg', function(params)
{
	this.data.client.request('/v2/organizations/' + param.orgId, 'DELETE', null, null, function()
	{
		this.next();
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('setOrgRole', function(params)
{
	this.data.client.request('/v2/organizations/' + this.data.orgId + '/' + params.type, 'PUT', null, {username : params.username}, function(result)
	{
		this.next(result);
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteOrgRole', function(params)
{
	this.data.client.request('/v2/organizations/' + params.orgId + '/' + params.type, 'DELETE', null, {username : params.username}, function(result)
	{
		this.next(result);
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('createSpace', function(params)
{
	this.data.client.request('/v2/spaces', 'POST', null, {organization_guid : this.data.orgId, name : params.name}, function(result)
	{
		if(result)
		{
			this.data.spaceId = result.metadata.guid;
			this.next({spaceId : result.metadata.guid});
		}
		else
		{
			this.error(result);
		}
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('setSpaceRole', function(params)
{
	this.data.client.request('/v2/users/' + this.data.userId + '/' + params.type + '/' + this.data.spaceId, 'PUT', null, null, function(result)
	{
		this.next(result);
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteSpaceRole', function(params)
{
	this.data.client.request('/v2/users/' + params.userId + '/' + params.type + '/' + params.spaceId, 'DELETE', null, null, function(result)
	{
		this.next();
	}.bind(this), function(error){
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteAllSpaceRole', function(params)
{
	var that = this;
	var userId = params.userId;
	this.data.client.request('/v2/users/' + userId + '/spaces', 'GET', null, null, function(result)
	{
		if(result)
		{
			var forEach = require('async-foreach').forEach;
			forEach(result.resources, function(space, index)
			{
				var done = this.async();
				
				pumpkin.execute([{name : 'deleteSpaceRole', params : {userId : userId, spaceId : space.metadata.guid, type : 'managed_spaces'}},
				                 {name : 'deleteSpaceRole', params : {userId : userId, spaceId : space.metadata.guid, type : 'audited_spaces'}},
				                 {name : 'deleteSpaceRole', params : {userId : userId, spaceId : space.metadata.guid, type : 'spaces'}}],
				                 function()
				                 {
				                	 done();
				                 },
				                 function(error)
				                 {
				                	 that.error(error);
				                 });
			},
			function()
			{
				that.next();
			});
		}
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('deleteAllOrgRole', function(params)
{
	var that = this;
	var userId = params.userId;
	var username = params.username;
	this.data.client.request('/v2/organizations', 'GET', null, null, function(result)
	{
		if(result)
		{
			var forEach = require('async-foreach').forEach;
			forEach(result.resources, function(org, index)
			{
				var done = this.async();
				
				pumpkin.execute([{name : 'deleteOrgRole', params : {username : username, orgId : org.metadata.guid, type : 'managers'}},
				                 {name : 'deleteOrgRole', params : {username : username, orgId : org.metadata.guid, type : 'auditors'}},
				                 {name : 'deleteOrgRole', params : {username : username, orgId : org.metadata.guid, type : 'billing_managers'}}],
				                 function(result)
				                 {
									done();
				                 },
				                 function(error)
				                 {
				                	 that.error(error);
				                 });
			},
			function()
			{
				that.next();
			});
		}
	}.bind(this),
	function(error)
	{
		this.error(error);
	}.bind(this));
});

pumpkin.addWork('sendInviteMail', function(params)
{
	var transporter = nodemailer.createTransport('smtps://' + _config.smtps.username + ':' + _config.smtps.password + '@' + _config.smtps.host);

	var mailOptions = {
		from: '"Administrator@ghama.io"', // sender address
		to: params.target, // list of receivers
		subject: 'Invite to ghama', // Subject line
		html: '<p>Invite you to ghama. Your first password is "1111". </p><p><a target="_blank" href="' + params.hostname + '/signin">Sign in to ghama.</a></p><p>To decline this invitation ignore this message.</p>' // html body
	};

	transporter.sendMail(mailOptions, function(error, info)
	{
		this.next(info);
	}.bind(this));
});


module.exports = function(app)
{
	app.post('/users/signup', function(req, res, next)
	{
		//가입
		var email = req.body.email;
		var password = req.body.password;
		
		var client = new CFClient({endpoint : req.session.cfdata.endpoint});
		pumpkin.setData({client : client});
		
		var done = function(result)
		{
			res.send({code : 201});
		};

		var error = function(name, error)
		{
			res.status(500).send({error : error});
		};

		pumpkin.execute([{name : 'login', params : {username : _config.admin.username, password : _config.admin.password}},
		                 {name : 'createUser', params : {username : email, password : password}},
		                 {name : 'getQuotaByName', params : {name : 'personal'}},
		                 {name : 'createOrg', params : {name : email + '_Org'}},
		                 {name : 'setOrgRole', params : {type : 'managers', username : email}},
		                 {name : 'createSpace', params : {name : 'dev'}},
		                 {name : 'setSpaceRole', params : {type : 'managed_spaces'}},
		                 {name : 'setSpaceRole', params : {type : 'spaces'}}], done, error);
	});
	
	app.post('/users/withdrawal', function(req, res, next)
	{
		var client = new CFClient(req.session.cfdata);
		pumpkin.setData({client : client});
		
		var done = function(result)
		{
			req.session.cfdata = null;
			res.send({code : 201});
		};

		var error = function(name, error)
		{
			res.status(500).send({error : error});
		};

		pumpkin.execute([{name : 'login', params : {username : _config.admin.username, password : _config.admin.password}}, {name : 'getUser', params : {username : req.session.cfdata.username}}], function(result)
		{
			var userId = result.userId;
			var username = req.session.cfdata.username;
			
			pumpkin.execute([{name : 'deleteAllOrgRole', params : {userId : userId, username : username}}, 
			                 {name : 'deleteAllSpaceRole', params : {userId : userId, username : username}},
			                 {name : 'deleteUser', params : {userId : userId}}], done, error);
		},
		function(error)
		{
			res.status(500).send({error : error});
		});
	});
	
	app.post('/users/invite', function(req, res, next)
	{
		var orgId = req.body.orgId;
		var target = req.body.target;
		
		var client = new CFClient(req.session.cfdata);
		pumpkin.setData({client : client});
		
		var forEach = require('async-foreach').forEach;

		var targetList = target.split(',');
		
		var resultList = [];
		client.setUserInfo(_config.admin.username, _config.admin.password);
		client.login(function(result)
		{
			forEach(targetList, function(email, index)
			{
				var done = this.async();
				
				email = email.trim();
				client.getUser(email, function(result)
				{
					var list = [];
					if(result.totalResults == 0)
					{
						list.push({name : 'createUser', params : {username : email, password : '1111'}});
						list.push({name : 'getQuotaByName', params : {name : 'personal'}});
						list.push({name : 'createOrg', params : {name : email + '_Org'}});
						list.push({name : 'setOrgRole', params : {type : 'managers', username : email}});
						list.push({name : 'createSpace', params : {name : 'dev'}});
						list.push({name : 'setSpaceRole', params : {type : 'managed_spaces'}});
						list.push({name : 'setSpaceRole', params : {type : 'spaces'}});
						list.push({name : 'sendInviteMail', params : {hostname : req.headers.host, target : email}});
					}
					else
					{
						pumpkin.data.userId = result.resources[0].id;
					}
					
					pumpkin.data.orgId = orgId;
					list.push({name : 'setOrgRole', params : {type : 'auditors', username : email}});
					
					pumpkin.execute(list, function(result)
					{
						resultList.push({entity : {username : email}, metadata : {guid : pumpkin.data.userId}});
						done();
					},
					function(name, error)
					{
						res.status(500).send({error : error});
					});
				},
				function(error)
				{
					res.status(500).send({error : error});
				});
			},
			function()
			{
				res.send(resultList);
			});
		}, function(error)
		{
			res.status(500).send({error : error});
		});
	});
	
	app.post('/users/password', function(req, res, next)
	{
		var cf = new CFClient(req.session.cfdata);
		if(!cf.isLogin())
		{
			res.statusCode = 302;
			res.end('signin');
			return;
		}
		
		var username = req.body.username;
		var id = req.body.id;
		var oldPassword = req.session.cfdata.password;
		var password = req.body.password;
		
		cf.setUserInfo(username, oldPassword);
		cf.login(function(result)
		{
			cf.changePassword(id, password, function(result)
			{
				if(result)
				{
					res.send(result);
				}
			},
			function(error)
			{
				if(error)
				{
					res.status(500).send({error : error});
				}
			});
		},
		function(error)
		{
			if(error)
				res.status(500).send({error : error});
		});
	});
	
	app.post('/users/getUser', function(req, res, next)
	{
		var cf = new CFClient(req.session.cfdata);
		if(!cf.isLogin())
		{
			res.statusCode = 302;
			res.end('signin');
			return;
		}
		
		var username = req.body.username;
		
		var client = new CFClient({endpoint : req.session.cfdata.endpoint});
		client.setUserInfo(_config.admin.username, _config.admin.password);
		client.login(function()
		{
			client.getUser(username, function(result)
			{
				res.send(result);
			},
			function(err)
			{
				res.status(500).send({error : err});
			});
		},
		function(err)
		{
			res.status(500).send({error : err});
		});
	});
	
	app.post('/users/createUser', function(req, res, next)
	{
		var email = req.body.email;
		var password = req.body.password;
		
		var client = new CFClient({endpoint : req.session.cfdata.endpoint});
		client.setUserInfo(_config.admin.username, _config.admin.password);
		client.login(function()
		{
			client.createUser(email, password, function(result)
			{
				res.send(result);
			},
			function(err)
			{
				res.status(500).send({error : err});
			});
		},
		function(err)
		{
			res.status(500).send({error : err});
		});
	});
	
	app.post('/users/updateUser', function(req, res, next)
	{
		var cf = new CFClient(req.session.cfdata);
		if(!cf.isLogin())
		{
			res.statusCode = 302;
			res.end('signin');
			return;
		}
		
		var id = req.body.id;
		var name = req.body.name;
		
		var client = new CFClient({endpoint : req.session.cfdata.endpoint});
		client.setUserInfo(_config.admin.username, _config.admin.password);
		client.login(function()
		{
			client.updateUser({id : id, name : name}, function(result)
			{
				res.send(result);
			},
			function(err)
			{
				res.status(500).send({error : err});
			});
		},
		function(err)
		{
			res.status(500).send({error : err});
		});
	});
	
	app.post('/users/delete', function(req, res, next)
	{
		var cf = new CFClient(req.session.cfdata);
		if(!cf.isLogin())
		{
			res.statusCode = 302;
			res.end('signin');
			return;
		}
		
		var id = req.body.id;
		
		var client = new CFClient({endpoint : req.session.cfdata.endpoint});
		client.setUserInfo(_config.admin.username, _config.admin.password);
		client.login(function()
		{
			client.deleteUser(id, function(result)
			{
				res.send(result);
			},
			function(err)
			{
				res.status(500).send({error : err});
			});
		},
		function(err)
		{
			res.status(500).send({error : err});
		});
	});
};