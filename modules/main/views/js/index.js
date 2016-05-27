var login = function(id, password)
{
	CF.signin({id : id, password : password}, function(result)
	{
		if(result && result.redirect)
			location.href = result.redirect;
		else
			location.href = '/organization';
	},
	function(error)
	{
		if(error.status == 500)
		{
			var reason = JSON.parse(error.responseText);
			
			if(reason.error.error_description == 'Bad credentials')
			{
				$('#signinForm .result-desc').text('Password is not accord. please check the account.').css('color', '');
			}
			else
			{
				$('#signinForm .result-desc').text(reason.error).css('color', '');
			}
		}
		else
		{
			$('#signinForm .result-desc').text(error.responseText).css('color', '');
		}
		
		$('#signProgress').hide().next().next().show().next().show();
	});	
};

$(document).ready(function()
{
	$('.navbar').hide();
	formSubmit($('#signinForm'), function(data)
	{
		var type = $('#signinForm input[type="submit"]').attr('data-type');
		if(!type || type == 'signin')
		{
			$('#signinForm .result-desc').text('Please, wait for sign in.').css('color', '#337ab7');
			$('#signProgress').css('display', 'inline-block').parent().find('input').hide();
			login(data.username, data.password);
		}
		else
		{
			if(data.password != data.passwordConfirm)
			{
				$('#signinForm .result-desc').text('Both password is not accord each other.').css('color', '');
			}
			else
			{
				$('#signinForm .result-desc').text('Please, wait for sign up.').css('color', '#337ab7');
				$('#signProgress').css('display', 'inline-block').parent().find('input').hide();
				
				CF.users('signup', {email : data.username, password : data.password}, function(result)
				{
					if(result && result.code == 201)
					{
						login(data.username, data.password);
					}
					else
					{
						$('#signProgress').hide().next().next().next().show().next().show();
						$('#signinForm .result-desc').text(JSON.stringify(result)).css('color', '');
					}
				},
				function(error)
				{
					$('#signProgress').hide().next().next().next().show().next().show();
					$('#signinForm .result-desc').text(error.error).css('color', '');
				});
			}
		}
	});
	
	$('#signin').on('click', function()
	{
		$(this).prev().attr('data-type', 'signin').click();
	});
	
	$('#signup').on('click', function()
	{
		if($(this).attr('data-mode') == 'signup')
		{
			$(this).prev().prev().attr('data-type', 'signup').click();
		}
		else
		{
			$('#signinForm .input-group input').val('');
			$('#signinForm .input-group input:first').focus();
			$(this).attr('data-mode', 'signup').parent().prev().show().children('input').attr('required', '');
			$(this).removeClass('btn-default').addClass('btn-primary').prev().hide().end().next().show();
		}
	});
	
	$('#cancel').on('click', function()
	{
		$(this).hide().prev().removeClass('btn-primary').addClass('btn-default').prev().show();
		$(this).prev().removeAttr('data-mode').parent().prev().hide().children('input').removeAttr('required');
	});
});