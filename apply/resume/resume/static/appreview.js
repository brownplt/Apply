
var fieldsUnlocked = false;

var basicInfo = { position: [ { name: 'Loading...' } ] }; // total hack

function makePositionOption(position) {
  return OPTION({ value: position.id.toString() }, position.name);
};

function disableInputs(rootElement,isDisabled) {
  var elts = rootElement.getElementsByTagName('input');
  for (var ix = 0; ix < elts.length; ix++) { elts[ix].disabled = isDisabled; };
};

function officialTranscriptWidget(applicant_id,institution) {
  return new CheckboxWidget(institution.transcript_official).serverSaving(function(ver) {
    return genRequest({url:'Applicant/'+applicant_id+'/verifyTranscript',fields:{cookie:authCookie,official:(ver?'yes':'no'),institution_id:institution.id}});
  }).dom
}

function adminSubmitTranscriptWidget(institution) {
  return DIV({className:'stmtsub'},
	     FORM({enctype:'multipart/form-data',
			     encoding:'multipart/form-data',
			     action:'submitTranscript',
			     method:'post',
			     target:'uptranscript'},
		  INPUT({type:'hidden',name:'id',value:institution.id}),
		  INPUT({type:'hidden',name:'cookie',value:authCookie}),
		  INPUT({type:'file',name:'transcript'}),
		  INPUT({type:'submit',value:'Upload'})));
}

// createInstitutionDOM: [institution] x authInfo x applicant info -> DOM
function createInstitutionDOM(institutions, curAuth, ai) {
  return DIV(
	     map(function(institution) {
	       return UL({className:'key-value'},
			    LI(TD(institution.name)));
			    /*			    TR(TH("Attended:"),TD(institution.start_date + 
						  " to " + 
						  institution.end_date)),
			    TR(TH("Major:"),TD(institution.major)),
			    TR(TH("Degree:"),TD(institution.degree.shortform)),
			    TR(TH("GPA:"),TD(institution.gpa + 
					     " of " + 
					     institution.gpa_max)),
			    TR(TH("Transcript:"),TD(institution.lastSubmitted == 0 ?
						    (curAuth.role == 'admin' ?
						     DIV('None yet - upload here',
							 adminSubmitTranscriptWidget(institution))
						     :
						     "N/A")
						    :
						    DIV(A({href:"Applicant/" + 
							      ai.id + 
							      "/getTranscript.pdf?" + 
							      "cookie=" + 
							      authCookie + 
							      "&institution=" + 
							      institution.id},
							  "Download"),
							curAuth.role == 'admin' ?
							DIV('Submit new (overwrites)',
							    adminSubmitTranscriptWidget(institution))
							:
							SPAN()))),
			    TR(TH("Transcript Official?"), TD(institution.lastSubmitted == 0 ?
							      "N/A"
							      :
							      (curAuth.role == 'admin' ?
							       officialTranscriptWidget(ai.id,institution)
							       :
							       (institution.transcript_official ?
							       "YES" : "NO")))));*/

	     },
		 institutions));
  /** Table format
      TR(TH("Name"),
      TH("Start"),
      TH("End"),
      TH("Major"),
      TH("Degree"),
      TH("GPA"),
      TH("Transcript"),
      TH("Official?")),
      map(function(institution) {
      return TR(
      TD(institution.name),
      TD(institution.start_date),
      TD(institution.end_date),
      TD(institution.major),
      TD(institution.degree.shortform),
      TD(institution.gpa + "/" + institution.gpa_max),
      TD(institution.lastSubmitted == 0 ?
      "N/A" : 
      A({href:"Applicant/" + ai.id + "/getTranscript?" + 
      "cookie="+authCookie+"&institution="+institution.id},
      "View")),
      TD(institution.transcript_official ? 'Yes' : 'No'));
      },institutions));
  **/
	    
}

function reviewsVisible(auth, reviewers, reviews) {
  var this_reviewer = filter(function(revr) {
    return revr.uname == auth.username;}, 
			     reviewers);
  if(this_reviewer.length == 0) { return true; }
  this_reviewer = this_reviewer[0];

  if(!this_reviewer.committee) { return true; }

  var this_review = filter(function(rev) {return rev.reviewerName == this_reviewer.uname;},reviews);
  if(this_review.length == 0) { return false; }
  else { return true; }
}

function makeUnsubmittedRequest(letter) {
  var requestAgain = A({ href: 'javascript:undefined' }, "request again");

  var requestLine = SPAN({ style: { fontSize: 'smaller' } },
			 letter.lastRequested ? "(last requested on " + letter.lastRequestedStr + 
			 "; " 
                         : "(not yet requested; ",
			 requestAgain,")");


  getFilteredWSO_e(extractEvent_e(requestAgain,'click').lift_e(function(_) {
	requestLine.innerHTML = "(request sent)";
      })
    .constant_e(genRequest({url: 'Admins/requestReference', 
	    fields: { cookie: authCookie, id: letter.id } })));
  return requestLine;
};

function loader() {
  var flapjax = flapjaxInit();
  var exceptsE = captureServerExcepts(); 
  exceptsE.filter_e(function(_) {return _.value == 'denied';}).transform_e(function(_) {window.location='login.html?expired=true'});

  var onLoadTimeE = receiver_e();

  authCookie = getCookie('resumesession');
	
  demoEventsE = receiver_e();
  document.startDemo = function(cb) {demoEventsE.transform_e(function(evt) {cb(evt);})};

  var basicInfoE = getBasicInfoSE(onLoadTimeE);
  var curAuthE = getAuthE(onLoadTimeE,authCookie);

  basicInfoE.lift_e(function(v) { basicInfo = v; });
	
  var appReloadsE = receiver_e();
  var applicantB = merge_e(getFilteredWSO_e(merge_e(onLoadTimeE,extractEvent_e('upletter','load')).constant_e(genRequest(
    {url:'Applicant/'+$URL('id')+'/get',
     fields:{cookie:authCookie},
     asynchronous: false}))),appReloadsE).startsWith({name:'',highlights:{},pending_highlights:{},areas:[],gender:'Unknown',position: { name: 'Loading...' }, ethnicity:'zu',components:[],email:'',uname:'',refletters:[],reviews:[],institutions:[],hiddenunames:[]});
	
  var revsB = getFilteredWSO_e(onLoadTimeE.constant_e(genRequest(
    {url:'getReviewers',
     fields:{cookie:authCookie,id:$URL('id')}}))).startsWith([]);


  var myInitRevB = getFilteredWSO_e(onLoadTimeE.constant_e(genRequest(
    {url:'Applicant/'+$URL('id')+'/Review/get',
     fields:{cookie:authCookie}}))).startsWith(null);

  var unlockEdits = extractEvent_e('unlockClassificationEdits','click')
    .collect_e(true /* initially disabled */,function(_,disabled) {
	demoEventsE.sendEvent({ action: 'fieldsUnlocked' });
	$('unlockClassificationEdits').src = !disabled 
	? 'images/locked.png' : 'images/unlocked.png';
	return !disabled;
      });

  lift_e(function(basicInfo,curAuth) {

      applicantB.transform_b(function(a) {
	  setHeadAndTitle(basicInfo,a.name,
			  [A({href:'login.html?logout='+authCookie},'Log Out'),
			   A({href:'reviewer.html'},'Back to List')])});

      insertDomB(applicantB.transform_b(function(a) {return H2(a.name,DIV({className:'sub'},'application'));}),'appname');

      insertDomB(applicantB.transform_b(function(ai) {
	    var widget = new CheckboxListWidget(
						map(function(a) {return {k:a.id,v:a.name};},basicInfo.areas.sort(function(a,b) { return a.name > b.name ? 1 : -1;})),
						map(function(a) {return a.id;},ai.areas)	
						).serverSaving(function(careas) {
						    demoEventsE.sendEvent({action:'areaSet'});
						    return genRequest({url:'Applicant/'+$URL('id')+'/setAreas',fields:{cookie:authCookie,areas:careas}});
						  }).dom;

	    disableInputs(widget,true);

	    unlockEdits.lift_e(function(v) { disableInputs(widget,v); });
	    return DIV(H4('area'),widget);
	  }),'area','beginning');
	
      insertDomB(applicantB.transform_b(function(ai) {
	    var widget = new SelectWidget(ai.gender,
					  map(function(g) {return OPTION({value:g},g);},basicInfo.genders))
	      .serverSaving(function(gen) {
		  return genRequest({url:'Applicant/'+$URL('id')+'/setGender',fields:{cookie:authCookie,gender:gen}});}).dom;
	    widget.disabled = true;
	    unlockEdits.lift_e(function(v) { widget.disabled = v; });

	    return DIV(H4('gender'),widget);
	  }),'gender','beginning');

      insertDomB(applicantB.transform_b(function(ai) {
	    var widget = new SelectWidget(ai.position.name,
					  map(makePositionOption,basicInfo.positions))
	      .serverSaving(function(gen) {
		  return genRequest({
		    url: 'Applicant/'+$URL('id')+'/setPosition',
		    fields: { cookie: authCookie, id: gen } }); 
		}).dom;
	    widget.disabled = true;
          
	    unlockEdits.lift_e(function(v) { widget.disabled = v; });  
	    return DIV(H4('position'),widget);
	  }),'position','beginning');
                     
	
      insertDomB(applicantB.transform_b(function(ai) {
	    var ethopts = [];
	    for(var k in basicInfo.ethnicities)
	      if (basicInfo.ethnicities.hasOwnProperty(k))
		ethopts.push(OPTION({value:k},basicInfo.ethnicities[k]));
	    var widget = new SelectWidget(ai.ethnicity,ethopts).serverSaving(function(eth) {
		return genRequest({url:'Applicant/'+$URL('id')+'/setEthnicity',fields:{cookie:authCookie,ethnicity:eth}});}).dom;

	    widget.disabled = true;
	    unlockEdits.lift_e(function(v) { widget.disabled = v; });
	    return DIV(H4('ethnicity'),widget);
	  }),'ethnicity','beginning');

      appCompsB = applicantB.transform_b(function(ai) {
	  var ret = {id:ai.id,contact:[],statements:[],testnames:[],tests:{}};
	  var acs =  toObj(ai.components,function(c) {return c.typeID;});
	  map(function(comp) {
	      var cv = objCopy(comp);
	      if(comp.type == 'statement') {
		cv.submitted = (acs[comp.id] ? acs[comp.id].lastSubmitted : 0);
		cv.comp_id = (acs[comp.id] ? acs[comp.id].id : 0);
		ret.statements.push(cv);
	      }
	      else if (comp.type == 'test_score') {
		var scores = filter(function(ai_comp) {
		    return ai_comp.typeID == comp.id;
		  }, ai.components);
		if(scores.length == 0) {
		  scores[0] = {submitted:0, verified:false, value:0, date:"", comp_id:0};
		}

		scores = map(function(ai_comp) {
		    ai_comp.submitted = ai_comp.lastSubmitted;
		    return ai_comp;
		  }, scores);
		
		ret.tests[comp.name] = scores;
		ret.testnames.push(comp.name);
	      }
	      else {
		cv.value = (acs[comp.id] ? acs[comp.id].value : 0);
		ret.contact.push(cv);
	      }
	    },basicInfo.components);
	  return ret;
	});

      insertDomB(appCompsB.transform_b(function(comps) {
	    return DIV(
		       H4('personal'),
		       UL({className:'material-list'},
			  map(function(stmt) {


			      var li = stmt.submitted ?
				LI({className:'submitted'},
				   (A({href:'Applicant/'+comps.id+'/getStatement.pdf?cookie='+authCookie+'&comp='+stmt.id},stmt.name)))
				:
				LI({className:'unsubmitted'},stmt.name);
			      return li;
			    },comps.statements)
			  /*			  LI({style:{textAlign:'center'}},
			     A({href:'Applicant/'+comps.id+'/getCombined.pdf?cookie='+authCookie},
			     'Get Combined PDF'))*/
			  ));
	  }),'personal','beginning');


      insertDomB(appCompsB.transform_b(function(comps) {
	    var tests = comps.tests;
	    var applicant_id = comps.id;
	    return DIV(
			  map(function(testname) {
			      var scores = tests[testname];
			      var li = scores[0].submitted ?
				DIV(H4({classname: 'submitted'},testname),
				   TR(TH("Score"),
				      //TH("Date"),
				      TH("Verified?")),
				   
				   map(function(score) {
				       var verifyDOM = curAuth.role == 'admin' ? 
				       new CheckboxWidget(score.verified).serverSaving(function(ver) {
					 return genRequest({url:'Applicant/'+applicant_id+'/verifyComponent',fields:{cookie:authCookie,verify:(ver?'yes':'no'),comp_id:score.id}});
					 }).dom
				       :
				       SPAN(score.verified ? 'Yes' : 'No');
				       return TR(TD(score.value.toString()),
						 //TD(score.date.toString()),
						 TD(verifyDOM));
				     }, scores)) :
				H4({classname:'unsubmitted'},testname);
			      return li;
			    }, comps.testnames)
			  );
	  }),'tests','beginning');

      insertDomB(applicantB.transform_b(function(ai) {
	    var institutions = ai.institutions;
	    return DIV("Details about these institutions can be found in the 'Transcripts' and 'Full Application' links above.",
		       createInstitutionDOM(institutions,curAuth,ai));
	  }), 'institutions', 'beginning');
		
      insertDomB(switch_b(applicantB.transform_b(function(ai) {
	      return DIVB(
			  H4('letters'),
			  ULB({className:'material-list'},
			      map(function(lttr) {
				  if(lttr.submitted)
				    return LI({className:'submitted'},A({href:'letter-'+lttr.id+'.pdf?cookie='+authCookie+'&id='+lttr.id},lttr.name), " (" + lttr.email + ")");
				  else {
				    if(curAuth.role == 'admin') {							
				      upl = new ToggleWidget('(upload)','(close upload box)');
				      uplBoxB = upl.behaviors.toggled.transform_b(function(tog) {
					  return tog ? DIV({className:'stmtsub'},'Upload Letter: ',
							   FORM({enctype:'multipart/form-data',
								 encoding:'multipart/form-data',
								 action:'submitLetter',
								 method:'post',target:'upletter'},
							     INPUT({type:'hidden',name:'id',value:lttr.id}),
							     INPUT({type:'hidden',name:'cookie',value:authCookie}),
							     INPUT({type:'file',name:'letter'}),
							     INPUT({type:'submit',value:'Upload'}))) : SPAN();});
				      return LIB({className:'unsubmitted'},lttr.name, 
						 " (" + lttr.email + ") ", upl.dom,
						 uplBoxB,' ', makeUnsubmittedRequest(lttr));
				    }
				    return LI({className:'unsubmitted'}, lttr.name);
				  }
				},ai.refletters)));
	    })),'letters','beginning');
	
      var contRowsB = appCompsB.transform_b(function(comps) {
	  return map(function(cinfo) {
	      return TR(TH(cinfo.name+':'),TD((cinfo.type == 'contactweb' && cinfo.value) ? A({href:showWebsite(cinfo.value)},cinfo.value) : cinfo.value));
	    },comps.contact);});
      var emailCellB = applicantB.transform_b(function(ai) {
	  return TD(ai.email,A({href:'mailto:'+ai.email},' ',IMG({className:'icon',src:'images/envelope.png',alt:'Send Mail'})));
	});

      insertDomB(TABLEB({className:'key-value'},TBODYB(
						       TRB(TH('Email: '),emailCellB),
						       contRowsB)),'contact','beginning');

      var saveBtn = new ButtonWidget('Save Draft');
      var subBtn = new ButtonWidget('Submit Review');
      var revBtn = new ButtonWidget('Revert to Submitted');

      var myRevB = merge_e(
			   myInitRevB.changes(),
			   getFilteredWSO_e(revBtn.events.click
					    .filter_e(function(_) {return confirm('Are you sure you want to replace your draft with your published review? All changes will be lost!');})
					    .constant_e(genRequest(
	{url:'Applicant/'+$URL('id')+'/Review/revert',
	 fields:{cookie:authCookie}})))).startsWith(myInitRevB.valueNow());

      var cbw = new InputWidgetB(
				 CombinedInputWidget,
				 myRevB.transform_b(function(myrev) {
				     if(!myrev) myrev = {scoreValues:[],comments:'',advocate:'none'}
				     var scorewidg = new CombinedInputWidget(
									     map(function(sc) {
										 return new SelectWidget(undefined,
													 [OPTION({value:-1},'No Score')].concat(map(function(sv) {
													       return OPTION({value:sv.id,selected:inList(sv.id,myrev.scoreValues)},''+sv.number+
															     (sv.explanation != '' ? ' - '+sv.explanation : ''));
													     },sc.values))).toTableRow(sc.name);},basicInfo.scores),function() {return TABLE({className:'key-value'},TBODY(slice(arguments,0)));});
				     return [new TextAreaWidget(myrev.comments,30,60),
					     scorewidg,
					     new RadioListWidget([
								  {k:'comment',v:'This is a comment. (all scores are ignored)'},
								  {k:'advocate',v:SPAN('I will advocate ',STRONG('for'),' this candidate.')},
								  {k:'detract',v:SPAN('I will advocate ',STRONG('against'),' this candidate.')},
								  {k:'none',v:'Neither, but save my scores and review.'}],
								 myrev.advocate)
					     ];}),
				 constant_b(
					    function(ta,sw,ad) {
					      return DIV({className:'review-form'},STRONG({className:'enterrev'},'Enter A Review or Comment'),
							 sw,ad,BR(),saveBtn.dom,subBtn.dom,revBtn.dom,ta);})
				 );
      var cChangeE = cbw.behaviors.value.changes().calm_e(10000);
      cbw = cbw.draftSaving(
			    merge_e(merge_e(cChangeE,saveBtn.events.click).constant_e('save'),subBtn.events.click.constant_e('submit')),
			    function(ss,info) {
			      demoEventsE.sendEvent({action:'subreview'});
			      return genRequest({url:'Applicant/'+$URL('id')+'/Review/submit',
				    fields: {cookie:authCookie,scores:filter(function(k) {return k != -1;},info[1]), comments:info[0], advdet:info[2],
				      draft:(ss == 'save' ? 'yes' : 'no')}});
			    }
			    );

      insertDomB(cbw.dom,'revform');

      var appRevsB = merge_e(applicantB.changes(),cbw.events.serverResponse).startsWith(applicantB.valueNow()).transform_b(function(app) {return app.reviews;});

      insertDomB(transform_b(function(revs,reviewers) {
	    function getScoreList(rev) {
	      var slist = map(function(sid) {
		  return basicInfo.svcs[sid].name + ': '+basicInfo.svnum[sid];
		},rev.scoreValues);
	      slist.sort();
	      return ' '+slist.join(', ');
	    }
	    return reviewsVisible(curAuth, reviewers, revs) ? 
						  UL({className:'review-list'},
						     map(function(rev) {
						       var advstr = (rev.advocate == 'detract' ?
								     SPAN({style:{color:'#aa0000'}},' (detract)') : (rev.advocate == 'advocate' ? 
														     SPAN({style:{color:'#00aa00'}},' (advocate)') : ''));
						       return LI(STRONG(rev.reviewerName,(rev.advocate == 'comment' ? ' (Comment)' : getScoreList(rev)),advstr),
								 paraString(rev.comments,'pre',0));
						     },revs)) :
	      P('Reviews will be shown when you submit your own.');
      },appRevsB,revsB),'otherrevs');

      insertDomB(applicantB.transform_b(function(app) {
	    if(app.highlights.length > 0) {
	      var applist = fold(function(v, acc) {return (acc == '' ? v.highlighteeName : acc+', '+v.highlighteeName);},'',app.highlights);
	      var remSelf = fold(function(v, acc) {return (v.highlighteeName == curAuth.username ? true : acc);},false,app.highlights);
	      if(remSelf) {
		var rsLink = A({href:'javascript:undefined',className:'remself'},'(remove me)');
		getFilteredWSO_e(extractEvent_e(rsLink,'click').constant_e(genRequest(
										      {url:'Applicant/'+app.id+'/unhighlight',
											  fields:{cookie:authCookie}}))).transform_e(function(unhl) {
											      appReloadsE.sendEvent(unhl);
											    });
	      }
	      else
		var rsLink = '';
	      return P('This applicant has been brought to the attention of: ',applist,' ',rsLink);
	    }
	    else return SPAN();
	  }),'highlight-list');

      insertDomB(
		 switch_b(lift_b(function(app,revs) {
		       var hls = toObj(app.highlights,function(a) {return a.highlighteeName;});
		       var optionlist = map(function(revr) {return OPTION({value:revr.id,disabled:hls[revr.uname]?true:false},revr.uname);},
					    revs.sort(function(x,y) { return stringCmp(x.uname,y.uname); }));
		       optionlist.push(OPTION({value:'None',disabled:true},'None'));
		       var hladd = new SelectWidget('None',
						    optionlist).withButton(
								 new ButtonWidget('OK'),
								 function(sel,btn) {return P('Bring this applicant to the attention of ',sel,btn);}
								 ).serverSaving(function(selectee) {
								   return genRequest({url:'Applicant/'+app.id+'/highlight',
											    fields:{cookie:authCookie,highlightee:selectee}});
								   });
		       hladd.events.serverResponse.transform_e(function(sr) {appReloadsE.sendEvent(sr);});
		       return (hladd.dom instanceof Behaviour ? hladd.dom : constant_b(hladd.dom));
		     },applicantB,revsB)),'highlight-add');


      insertDomB(
		 switch_b(applicantB.transform_b(function(app) {
		       if(curAuth.role == 'admin') {
			 var rejectBox = new CheckboxWidget(app.rejected).serverSaving(function(rej) {
			     return genRequest({url:'Applicant/'+app.id+'/reject',fields:{cookie:authCookie,reject:(rej?'yes':'no')}});
			   });
			 return PB('Reject Applicant? ',rejectBox.dom);
		       }
		       else {
			 return app.rejected ? PB(STRONG('This applicant has been rejected.')) : SPANB();
		       }
		     })),'reject');
      insertDomB(
		 switch_b(applicantB.transform_b(function(app) {
		       var isHidden = fold(function(v, acc) {return acc || v == curAuth.username;},false,app.hiddenunames);
		       var hideBox = new CheckboxWidget(isHidden).serverSaving(function(hide) {
			   return genRequest({url:'Applicant/'+app.id+'/hide',fields:{cookie:authCookie,hide:(hide?'yes':'no')}});
			 });
		       return PB('Hide Applicant? ',hideBox.dom,' (this will stop you from seeing this applicant ever again, unless you specifically check "show hidden applicants" when filtering the applicant list.)');
		     })),'hide');
      insertDomE(iframeLoad_e('upletter').transform_e(resultTrans('You have successfully uploaded the reference letter.')),'ls-result');

      if(curAuth.role == 'admin')
	insertDomB(
		   applicantB.transform_b(function(app) {
		       return P(STRONG('username: '),SPAN(app.uname));
		     }),'uname');
    },basicInfoE,curAuthE);
  onLoadTimeE.sendEvent('Loaded!');
}
