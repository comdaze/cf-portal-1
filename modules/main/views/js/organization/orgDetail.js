(function()
{
	var ORG_NAME_UPDATE_TIME = 3;
	var ORG_QUOTA_REFRESH_TIME = 60; // org quota는 60초에 한 번씩만 새로고침.
	var organizationQuota = null;
	var appQuotaSum = null;
	
	var orgQuotaRefreshTimer = null;
	
	var updateOrgQuota = function()
	{
		if(appQuotaSum != null && organizationQuota != null)
		{
			var p = (appQuotaSum / organizationQuota) * 100;
			$('#quotaProgress').removeClass('active').addClass('active').css('width', p + '%').text(appQuotaSum + 'MB / ' + organizationQuota + 'MB (' + p + '%)');
		}
	};
	
	var getOrgQuota = function(space)
	{
		CF.async({url : space.organization.entity.quota_definition_url}, function(result)
		{
			if(result)
			{
				if(result.entity)
				{
					organizationQuota = result.entity.memory_limit;
					updateOrgQuota();
				}
				else
				{
					$('#quotaProgress').css('width', '0%').removeClass('active').text(result.description);
				}
			}
			else
			{
				$('#quotaProgress').css('width', '0%').removeClass('active').text('Organization quota is not found.');
			}
		});
	};
	
	_ee.on('space_selected', function(space)
	{
		$('#orgName span:first').text(space.organization.entity.name);
		$('#quotaProgress').addClass('active').css('width', '100%').text('Organization quota loading...');
		
		if(orgQuotaRefreshTimer)
		{
			clearInterval(orgQuotaRefreshTimer);
			orgQuotaRefreshTimer = null;
		}
		
		getOrgQuota(space);
		orgQuotaRefreshTimer = setInterval(function()
		{
			getOrgQuota(space);
		}, 1000 * ORG_QUOTA_REFRESH_TIME);
	});
	
	_ee.on('setAppList_done', function(appList)
	{
		appQuotaSum = 0;
		for(var i=0; i<appList.length; i++)
		{
			if(appList[i].entity.state == 'STARTED')
				appQuotaSum += appList[i].entity.memory;
		}
		
		updateOrgQuota();
	});
	
	$(document).ready(function()
	{
		$('#orgName span').on('click', function()
		{
			var prev = $(this).text();
			$(this).attr('contenteditable', '').focus();
			
			$(this).on('blur', function()
			{
				if(prev != $(this).text())
				{
					var space = $('#' + _global.hash.space).get(0).item;
					
					$('.org-name-description').text('Please, wait for update.').css('color', '#337ab7');
					CF.async({url : '/v2/organizations/' + space.organization.metadata.guid, method : 'PUT', form : {name : $(this).text()}}, function(result)
					{
						if(result)
						{
							if(result.entity)
							{
								$('.org-name-description').text('Updated.').css('color', '#337ab7');
								setTimeout(function()
								{
									$('.org-name-description').text('');
								}, 1000 * ORG_NAME_UPDATE_TIME);
							}
							else
							{
								$('#orgName span:first').text(prev);
								$('.org-name-description').text(result.description).css('color', '');
							}
						}
						else
						{
							$('#orgName span:first').text(prev);
							$('.org-name-description').text('Unknown error.').css('color', '');
						}
					},
					function(error)
					{
						$('#orgName span:first').text(prev);
						$('.org-name-description').text(error.stack ? error.stack : error).css('color', '');
					});
				}
				
				$(this).removeAttr('contenteditable').off('blur').off('keyup');
			});
			
			$(this).on('keydown', function(e)
			{
				if(e.keyCode == 13)
				{
					$(this).blur();
					e.preventDefault();
					e.stopPropagation();
				}
				else if(e.keyCode == 27)
				{
					$(this).text(prev);
					$(this).removeAttr('contenteditable').off('blur').off('keyup').blur();
					e.preventDefault();
					e.stopPropagation();
				}
			});
		});
	});
})();