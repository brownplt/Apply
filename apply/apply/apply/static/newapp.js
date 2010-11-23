    

function loader() {
  var flapjax = flapjaxInit();
  var exceptsE = captureServerExcepts(); 

  var onLoadTimeE = receiver_e();
  
  var position = null;
  var basicInfoE = getBasicInfoE(onLoadTimeE);
  basicInfoE.lift_e(function(bi) { 
      setHeadAndTitle(bi,'Create Account'); 
      position = bi.positions[0].id;
    });
	
  var veri = $URL('verify');

	
  var attemptsE = extractEvent_e('vfy','click').transform_e(function(_) {
      var uname = $('uname').value;
      var password = $('password').value;

      var repassword = $('repassword').value;

      if (!$('firstname').value) {
	return { error: 'Please enter your first name.' };
      }
  
      if (!$('lastname').value) {
	return { error: 'Please enter your last name.' };
      }

      if(password != repassword) {
	return { error: 'You retyped your password incorrectly. Please '
	}                  + 're-enter it.'};
    
		
      return genRequest({
	url:'UnverifiedUser/newApplicant',
	    fields: {
	  username:uname,
	      password:password,
	      verify:veri,
	      firstname: $('firstname').value,
	      lastname: $('lastname').value,
	      gender:$('gender').value,
	      position: position,
	      ethnicity:$('ethnicity').value}
	});
    });

  var resultsE = getFilteredWSO_e(attemptsE.filter_e(noErrors));

  var cookieE = getFilteredWSO_e(resultsE.filter_e(noErrors).transform_e(function(_) {
	return genRequest(
    {url:'Auth/getCookie',
     fields:{username:$('uname').value,password:$('password').value},
     asynchronous: false});
      }));
  cookieE.filter_e(function(c) {return c;}).transform_e(function(c) {
      setCookie('resumesession',2,c[0]); 
  
      if(c[1].role == 'applicant')
	window.location = 'applicant.html';
      else
	window.location = 'reviewer.html';
    });
				
  insertDomE(merge_e(attemptsE,resultsE).filter_e(onlyErrors).transform_e(resultTrans('')),'errortext');

  onLoadTimeE.sendEvent('loaded!');
}
