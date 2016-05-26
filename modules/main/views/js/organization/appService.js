(function()
{
	var credentialsToHtml = function(credentials)
	{
		var html = '';
		
		if(typeof credentials == 'object')
		{
			for(var key in credentials)
			{
				html += '<p class="pre-label">' + key + '</p>';
				html += '<pre>' + credentials[key] + '</pre>';
			}
			
			html += '<p class="pre-label">JSON</p>';
			html += '<pre>' + JSON.stringify(credentials, null, 4) + '</pre>';
		}
		
		return html;
	};
	
	var serviceBindingPumpkin = new Pumpkin();
	serviceBindingPumpkin.addWork('getServiceInstanceForServiceBinding', function()
	{
		var next = this.next;
		var error = this.error;
		
		CF.async({url : this.data.serviceBinding.entity.service_instance_url}, function(result)
		{
			if(result)
			{
				if(result.entity)
				{
					next(result);
				}
				else
				{
					error(result.description);
				}
			}
			else
			{
				error('Service instance is not found.');
			}
			
		}, function(error)
		{
			error(error);
		});
	});
	
	serviceBindingPumpkin.addWork('getServicePlan', function(serviceInstance)
	{
		var next = this.next;
		var error = this.error;
		
		CF.async({url : '/v2/service_plans/' + serviceInstance.entity.service_plan_guid}, function(result)
		{
			if(result)
			{
				var servicePlan = result;
				if(servicePlan.entity)
				{
					CF.async({url : servicePlan.entity.service_url}, function(result)
					{
						if(result)
						{
							next({serviceInstance : serviceInstance, servicePlan : servicePlan, service : result});
						}
						else
						{
							next({serviceInstance : serviceInstance, servicePlan : servicePlan});
						}
					},
					function(error)
					{
						next({serviceInstance : serviceInstance, servicePlan : servicePlan, service : error});
					});
				}
				else
				{
					next({serviceInstance : serviceInstance, servicePlan : servicePlan});
				}
			}
			else
			{
				next({serviceInstance : serviceInstance});
			}
		},
		function(error)
		{
			next({serviceInstance : serviceInstance, servicePlan : error});
		});
	});
	
	var serviceListPumpkin = new Pumpkin();
	serviceListPumpkin.addWork('getServiceInstances', function()
	{
		var that = this;
		var next = this.next;
		var space = $('#' + _global.hash.space).get(0);
		CF.async({url : '/v2/spaces/' + space.item.metadata.guid + '/service_instances'}, function(result)
		{
			if(result)
			{
				that.data.services = result;
				next();
			}
			else
			{
				next();
			}
		},
		function(error)
		{
			next();
		});
	});
	
	serviceListPumpkin.addWork('getUserProvidedServiceInstances', function()
	{
		var that = this;
		var next = this.next;
		CF.async({url : '/v2/user_provided_service_instances'}, function(result)
		{
			if(result)
			{
				that.data.userProvidedServices = result;
				next();
			}
			else
			{
				next();
			}
		},
		function(error)
		{
			next();
		});
	});
	
	var bindingService = function(context, serviceBinding, callback)
	{
		var credentials = serviceBinding.entity.credentials;
		serviceBindingPumpkin.setData({serviceBinding : serviceBinding});
		serviceBindingPumpkin.execute(['getServiceInstanceForServiceBinding', 'getServicePlan'], function(params)
		{
			var serviceInstance = params.serviceInstance;
			var servicePlan = params.servicePlan;
			var service = params.service;
			
			var template = $('#appServiceTemplate').html();
			
			template = template.replace('{manageUrl}', serviceInstance.entity.dashboard_url)
					.replace('{name}', serviceInstance.entity.name)
					.replace('{credentials}', credentialsToHtml(credentials));
			
			var imageUrl = '';
			var supportUrl = '';
			var docsUrl = '';
			var description = '';
			
			if(service)
			{
				if(service.entity)
				{
					var extra = service.entity.extra;
					description = service.entity.label;
					
					if(extra)
					{
						extra = JSON.parse(extra);
						
						if(extra.imageUrl)
							imageUrl = extra.imageUrl;
						
						supportUrl = extra.supportUrl;
						docsUrl = extra.documentationUrl;
					}
				}
			}
			
			template = $(template.replace('{imgUrl}', imageUrl).replace('{description}', description).replace('{supportUrl}', supportUrl).replace('{docsUrl}', docsUrl));
			
			template.get(0).item = {serviceInstance : serviceInstance, servicePlan : servicePlan, service : service};
			
			var unbindButton = template.find('.confirm-button');
			confirmButton(unbindButton, function()
			{
				unbindButton.hide().prev().css('display', 'inline-block');
				CF.async({url : '/v2/service_bindings/' + serviceBinding.metadata.guid, method : 'DELETE'}, function(result)
				{
					var length = unbindButton.parent().parent().parent().find('tr').length;
					unbindButton.parent().parent().remove();
					
					$(context).find('.service-select').append('<option value="' + serviceInstance.metadata.guid + '">' + serviceInstance.entity.name + '</option>');
					
					if(length == 1)
					{
						$(context).find('.service-table tbody').html('<tr><td colspan="4" class="center-align">no service bindings</td></tr>');
					}
				},
				function(error)
				{
					$('<p>' + error + '</p>').insertAfter(confirmButton);
				});
			});
			
			$(context).find('.service-table tbody').append(template);
			
			callback();
		},
		function(workName, error)
		{
			$(context).find('.service-table tbody').append('<tr><td colspan="4" style="text-align: center;">' + error + '</td></tr>');
		});
	};
	
	var pumpkin = new Pumpkin();
	pumpkin.addWork('drawServiceList', function()
	{
		var context = this.data.context;
		
		var that = this;
		var next = this.next;
		CF.async({url : this.data.app.entity.service_bindings_url}, function(result)
		{
			if(result)
			{
				if(result.resources)
				{
					var serviceList = result.resources;
					that.data.serviceList = serviceList;
					
					$(context).find('.service-table tbody').html('');
					
					var forEach = new ForEach();
					forEach.async(serviceList, function(service, index)
					{
						var done = this.done;
						bindingService(context, service, done);
					},
					function()
					{
						$(context).find('.service-table .credentials').on('click', function()
						{
							if(!this.isShown)
							{
								$(this).find('span:first').text('Hide credentials');
								$(this).parent().next().show();
								
								this.isShown = true;
							}
							else
							{
								$(this).find('span:first').text('Show credentials');
								$(this).parent().next().hide();
								this.isShow = false;
							}
						});
						
						if(serviceList.length == 0)
						{
							$(context).find('.service-table tbody').append('<tr><td colspan="4" style="text-align: center;">no service bindings</td></tr>');
						}
						
						next();
					});
				}
				else
				{
					$(context).find('.servicesMessage').text(result.description).show();
				}
			}
			else
			{
				$(context).find('.servicesMessage').text('App services is not found.').show();
			}
		},
		function(error)
		{
			$(context).find('.servicesMessage').text(error.stack ? error.stack : error).show();
		});
	});
	
	pumpkin.addWork('getServiceList', function()
	{
		var context = this.data.context;
		
		var next = this.next;
		
		var that = this;
		var app = this.data.app;
		
		var selectElement = $(context).find('.service-select');
		
		serviceListPumpkin.setData({app : app});
		serviceListPumpkin.executeAsync(['getServiceInstances', 'getUserProvidedServiceInstances'], function()
		{
			try
			{
				var alreadyBindings = {};
				if(that.data.serviceList)
				{
					var list = pumpkin.data.serviceList;
					if(list)
					{
						for(var i=0; i<list.length; i++)
						{
							alreadyBindings[list[i].entity.service_instance_guid] = true;
						}
					}
				}
				
				if(this.data.services)
				{
					var list = this.data.services.resources;
					if(list)
					{
						for(var i=0; i<list.length; i++)
						{
							if(alreadyBindings[list[i].metadata.guid])
								continue;
							
							var option = $('<option value="' + list[i].metadata.guid + '">' + list[i].entity.name + '</option>');
							option.get(0).item = list[i];
							
							selectElement.append(option);
						}
					}
				}
				
				if(this.data.userProvidedServices)
				{
					var list = this.data.userProvidedServices.resources;
					if(list)
					{
						for(var i=0; i<list.length; i++)
						{
							if(alreadyBindings[list[i].metadata.guid])
								continue;
							
							var option = $('<option value="' + list[i].metadata.guid + '">' + list[i].entity.name + '</option>');
							option.get(0).item = list[i];
							
							selectElement.append(option);
						}
					}
				}
			}
			catch(err)
			{
				console.error(err);
			}

			next();
		},
		function(workName, error)
		{
			console.error(error);
		});
	});
	
	_ee.on('app_detail_services', function(context, app)
	{
		$(context).find('.service-container').hide();
		$(context).find('.servicesProgress').show();
		$(context).find('.servicesMessage').hide();
		
		pumpkin.setData({context : context, app : app});
		
		pumpkin.executeAsync(['drawServiceList'], function()
		{
			$(context).find('.servicesProgress').hide();
			$(context).find('.service-container').show();
			
			$(context).find('.service-select option:first').text('Services are loading...').parent().attr('disabled', '');
			
			pumpkin.executeAsync(['getServiceList'], function()
			{
				$(context).find('.service-select option:first').text('Select a service').parent().removeAttr('disabled');
			},
			function(workName, error)
			{
				console.error(error);
			});
		},
		function(workName, error)
		{
			console.error(error);
		});
		
		formSubmit($('.bind-form'), function(data)
		{
			data.app_guid = app.metadata.guid;
			$(context).find('.bind-progress').css('display', 'inline-block').next().hide().next().hide();
			$(context).find('.service-select').attr('disabled', '');
			CF.async({url : '/v2/service_bindings', method : 'POST', headers : {'Content-Type' : 'application/x-www-form-urlencoded'}, form : data}, function(result)
			{
				if(result)
				{
					if(result.entity)
					{
						$(context).find('.service-table td[colspan="4"]').remove();
						bindingService(context, result, function()
						{
							$(context).find('.bind-progress').hide().next().show().next().show();
							$(context).find('.service-select').val('').removeAttr('disabled');
						});
					}
					else
					{
						$(context).find('.bind-service-message').text(result.description);
					}
				}
				else
				{
					$(context).find('.bind-service-message').text('Service binding is failed.');
				}
			},
			function(error)
			{
				$(context).find('.bind-service-message').text(error);
			});
		});
		
		$(context).find('.bind-cancel').on('click', function()
		{
			$(this).prev().prev().prev().val('');
		});
	});
})();