
function displayPositions(basicInfo) {
  for (var ix = 0; ix < basicInfo.positions.length; ix++) {
    $('position').appendChild(OPTION({ value: basicInfo.positions[ix].id },
                                     basicInfo.positions[ix].name));
  };
  $('positionBlock').style.display = 'block';
};
    

function loader() {
  var flapjax = flapjaxInit();
  var exceptsE = captureServerExcepts(); 

  var onLoadTimeE = receiver_e();

  var basicInfoE = getBasicInfoE(onLoadTimeE);
  basicInfoE.transform_e(function(bi) {
      setHeadAndTitle(bi,'Create Account');
      if ($URL('app') == 'y') { displayPositions(bi); }
    });
  var veri = $URL('verify');

	
  var attemptsE = extractEvent_e('vfy','click').transform_e(function(_) {
      var uname = $('uname').value;
      var password = $('password').value;
      var repassword = $('repassword').value;

      if ($URL('app') == 'y' && $('position').value == "nothing") {
	return { error: 'Please choose the position you are applying for.' };
      };

      if(password != repassword)
	return {error:'You retyped your password incorrectly. Please re-enter it.'};
      else
	return genRequest({
	  url:'UnverifiedUser/verify',
	      fields:{username:uname,password:password,verify:veri,
		gender:$('gender').value,
		position: ($URL('app') == 'y') ? parseInt($('position').value) : -1,
		ethnicity:$('ethnicity').value}});
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

  if($URL('app') == 'y') {
    $('vsi').style.display = 'block';
  } else {
    $('demo').style.display = 'block';
  }
  onLoadTimeE.sendEvent('loaded!');
}
