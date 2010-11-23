function enters_e(dom) {
  return extractEvent_e(dom,'keypress').filter_e(function(e) {return e.keyCode == 13;});
}


function newAcctSuccess(successMsg) {
  return function(v) {
    if(v.error) {return toResultDom(v, successMsg);}
    if(v.verify) {
      verifyDom = P({className: 'feedback-success'},
		    DIV(successMsg,
			A({href:'newapp.html?verify=' + v.verify}, "Goto signup")));
      return P({className: 'feedback-success'},
	       verifyDom);
    }
    return toResultDom(v, successMsg);
  }
}


function loader() {
  var flapjax = flapjaxInit();
  var exceptsE = captureServerExcepts(); 

  document.startDemo = function(cb) { };

  var onLoadTimeE = receiver_e();



  var basicInfoE = getBasicInfoE(onLoadTimeE);
  basicInfoE.transform_e(function(bi) {setHeadAndTitle(bi,'Login')});
  var cookieE = iframeLoad_e('litarget');
  cookieE.filter_e(function(c) {return c;}).transform_e(function(c) {
      setCookie('resumesession',2,c[0]); 
      if(c[1].role == 'applicant')
	window.location = 'applicant.html';
      else
	window.location = 'reviewer.html';
    });
  reqAcctE = getFilteredWSO_e(snapshot_e(
					 merge_e(extractEvent_e('req-button',
								'click'),
						 enters_e('req-email')),
					 lift_b(function(email) {
					     return genRequest({url: 'UnverifiedUser/add',
								fields:{name:name,email:email}});
					   },$B('req-email'))));
  /**
  reqLtrsE = getFilteredWSO_e(snapshot_e(merge_e(extractEvent_e('ltr-button',
								'click'),
						 enters_e('ltr-email')),
					 $B('ltr-email').transform_b(function(email) {
					     return genRequest({url: 'Reference/getList',
								fields:{email:email}});
					   })));
  */
  /**
  insertDomE(reqLtrsE.transform_e(resultTrans('Your email has been sent.')),'referror');
  */
  insertDomE(reqAcctE.transform_e(newAcctSuccess('Thank you for requesting your account! You will receive an email shortly.')),'req-2');
  insertDomB(cookieE.filter_e(function(c) {return !c;}).constant_e(
								   P({className:'error'},'Login failed. Please try again.')).startsWith($URL('expired')?
																	P({className:'error'},'Your session has expired. Please login again.') : SPAN()),'logerror');

  showResetB = extractEvent_e('reset-toggle','click').collect_e(false,function(v,acc) {return !acc;}).startsWith(false);
  insertValueB(showResetB.transform_b(function(_) {return _ ? 'block' : 'none';}),'reset-info','style','display');
  reqResetE = getFilteredWSO_e(snapshot_e(merge_e(extractEvent_e('reset-button','click'),enters_e('reset-email')),
					  $B('reset-email').transform_b(function(email) {
					      return genRequest(
    {url: 'AuthInfo/resetPassword',
     fields:{email:email}});
					    })));
  insertDomE(reqResetE.transform_e(resultTrans('You will receive an email with your account information shortly.')),'reset-blurb');
  
  if($URL('logout')) {
    getFilteredWSO_e(onLoadTimeE.constant_e(genRequest({url:'Auth/logOut',fields:{cookie:$URL('logout')}})));
  }
  if($URL('expired')) $('expired').style.display='block';

  if($URL('switch')) {
    switch_login_e = getFilteredWSO_e(onLoadTimeE.constant_e(genRequest({url:'Auth/logInAs',fields:{cookie:$URL('switch'),user_id:$URL('user_id')}})));
    switch_login_e.transform_e(function(r) {if (!r.exception) { 
      if(r.role == 'applicant') {
	window.location = 'applicant.html'; 
      }
      else {
	window.location = 'reviewer.html';
      }
    } });
  }

  onLoadTimeE.sendEvent('Loaded!');
}


