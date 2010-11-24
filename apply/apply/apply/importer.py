from sqlobject import *
from common import *
from tex import texEscape
from pdftk import PDF
import common
import config
import sha, time, random, types, tempfile, os, sys
import resumetext
import resume

if config.usedb == 'mysql':
	__connection__ = connectionForURI('mysql://%s:%s@localhost/%s?charset=utf8&sqlobject_encoding=utf8' % (config.dbuser,config.dbpass,config.dbname))
elif config.usedb == 'sqlite':
	__connection__ = connectionForURI('sqlite:%s' % config.dbloc)

def baseApplicant(department,first,last,eth,country,email,uname,gender):

    print "---------------"
    print "NEW APPLICANT"
    print "---------------"
    print "first: " + first
    print "last: " + last
    print "eth: " + eth
    print "country: " + country
    print "email: " + email
    print "uname: " + uname
    print "gender: " + gender
    
    dept = resume.DepartmentInfo.selectBy(id=department)[0]

    if uname == '':
        uname = first.replace(" ","_").lower() + '_' + last.replace(" ","_").lower()

    pos = resume.ApplicantPosition.selectBy(department=dept)[0]

    auth = resume.AuthInfo(username=uname,
                           email=email,
                           name=uname,
                           role='applicant',
                           department=dept,
                           password_hash='asdf')
    
    return resume.Applicant(department=dept,
                            firstname=first,
                            lastname=last,
#                            ethnicity=eth,
                            country=country,
                            gender=gender,
                            auth=auth,
                            position=pos)

def institutionFromName(applicant,name):
    degree = resume.Degree.cSelectOne(applicant.department,name='None')
    print degree.name
    start_date = 'Not Reported'
    end_date = 'Not Reported'
    major = 'Not Reported'
    gpa = 0
    gpa_max = 0
    lastSubmitted = 0
    transcript_file = ''
    transcript_official = False
    
    return resume.ApplicantInstitution(applicant=applicant,
                                       name=name,
                                       degree=degree,
                                       start_date=start_date,
                                       end_date=end_date,
                                       major=major,
                                       gpa=gpa,
                                       gpa_max=gpa_max,
                                       lastSubmitted=lastSubmitted,
                                       transcript_file=transcript_file,
                                       transcript_official=transcript_official,
                                       department=applicant.department)
                                

def testScoreFromNameAndScore(applicant,test_name,score):
    test = resume.ComponentType.cSelectOne(applicant.department,short=test_name)

    return resume.Component(department=applicant.department,
                            applicant=applicant,
                            value=score,
                            type=test,
                            verified=False,
                            date='N/A',
                            lastSubmitted=int(time.time()))

def isData(val):
    copy = str(val)
    return copy.strip() != ''

def populateFromCSV(filename):
    department_id=1
    
    f = open(filename,'r')
    lines = []
    try:
        for line in f:
            lines.append(line)
    except:
        f.close()
        
    for l in lines:
        els = l.split(';')
        print len(els)
        print l
        i=0
        
        if('SCM' in els[1]): # skip masters students
            continue

        for el in els:
            els[i] = el.strip('"')
            i = i + 1
        last = els[2]
        first = els[3]
        citizenship = els[4]
        eth = els[5] # (no-one reports?)
        address = els[6]
        city = els[7]
        state = els[8]
        zipcode = els[9]
        country = els[10]
        email = els[11]
        phone = els[12] + els[13]
        grev = els[19]
        greq = els[20]
        grea = els[21]
        toefl = els[22]
        prev1 = els[23]
        prev2 = els[24]
	prev3 = els[25]
        gender = els[26]
        ref1 = els[30]
        ref2 = els[31]
        ref3 = els[32]

        if(not isData(country)):
            country = 'Unknown'
	if(gender == ' '):
	    gender = 'Unknown'
        
        app = baseApplicant(department_id,first,last,eth,country,email,'',gender)

	if(isData(prev3)):
		institutionFromName(app,prev3)
	if(isData(prev2)):
		institutionFromName(app,prev2)
	if(isData(prev1)):
		institutionFromName(app,prev1)

        if(isData(grev)):
            testScoreFromNameAndScore(app,'GREV',str(grev))
        if(isData(grea)):
            testScoreFromNameAndScore(app,'GREA',str(grea))
        if(isData(greq)):
            testScoreFromNameAndScore(app,'GREQ',str(greq))
        if(isData(toefl)):
            testScoreFromNameAndScore(app,'TOEFL',str(toefl))

def updateCitizenships(filename):
    department_id=1
    dept = resume.DepartmentInfo.selectBy(id=department_id)[0]
    
    f = open(filename,'r')
    lines = []
    try:
        for line in f:
            lines.append(line)
    except:
        f.close()
        
    for l in lines:
        els = l.split(';')
        i=0
        
        if('SCM' in els[1]): # skip masters students
            continue

        for el in els:
            els[i] = el.strip('"')
            i = i + 1
        last = els[2]
        first = els[3]
        citizenship = els[4]

	uname = (last + first).replace(' ','_')

	if(not isData(citizenship)):
		citizenship='United States'

	applicant = resume.Applicant.cSelectOne(dept,firstname=first,lastname=last)
	if(applicant):
		print applicant.uname + ': ' + applicant.country + '->' + citizenship
		applicant.country = citizenship


def transcriptFilename(applicant):
#	return applicant.uname + '.pdf'
	return applicant.uname.replace('_',' ') + '.pdf'

def addOrSetTranscript(applicant,component_type,transcript_file):
	transcript_type = resume.ComponentType.cSelectOne(applicant.department,
							  name=component_type)
	existing = resume.Component.cSelectOne(applicant.department,
					      type=transcript_type,
					      applicant=applicant)
	if(existing):
		print "  Existing " + component_type + " for " + applicant.uname + ".  Recreating."
		existing.destroySelf()
	
	resume.Component(department=applicant.department,
			 applicant=applicant,
			 type=transcript_type,
			 lastSubmitted=int(time.time()),
			 verified=True,
			 value=str(os.path.getsize(transcript_file.name)),
			 date='N/A')
	
	commandstr = "cp " + transcript_file.name.replace(' ','\ ') + ' ' + str(config.uploadPath) + '/' + str(applicant.id) + '-' + str(transcript_type.id) + '-pdf'
	os.system(commandstr)
	dept = resume.DepartmentInfo.selectBy(id=1)[0]
	dept.updateLastChange(applicant)

def importTranscripts(root_dir):
	importComponents(root_dir, "Transcripts")

def importFullApps(root_dir):
	importComponents(root_dir, "Full Application")

def importComponents(root_dir,component_type):
	dept = resume.DepartmentInfo.selectBy(id=1)[0]
	applicants = [x for x in resume.Applicant.selectBy(department=1)]

	for applicant in applicants:
		try:
			transcript_file = open(root_dir + '/' + transcriptFilename(applicant),'r')
			print "Processing file for applicant " +  applicant.uname
			addOrSetTranscript(applicant,component_type,transcript_file)
		except IOError:
			print "No file for applicant " + applicant.uname
	
	dept.updateLastChange()

# expects applicant-first_applicant-last_referrer-first_refferer-last_referrer-institution_referrer-email.pdf
def filename_to_ref_impl(dept, filename):

	simplename = os.path.split(filename)[1]

	pieces = (os.path.splitext(simplename)[0]).split('_');
	
	if (len(pieces) != 6):
		print "Something was wrong with the format.  Got these fragments from the filename:"
		print pieces
		
	username = pieces[0] + '_' + pieces[1]
	refname = pieces[2] + ' ' + pieces[3]
	refinst = pieces[4]
	refemail = pieces[5]
	
	user = resume.AuthInfo.cSelectOne(dept,username=username)
	applicant = resume.Applicant.cSelectOne(dept,auth=user)
	print applicant.uname
	return resume.Reference(department = dept,
				code = 0,
				applicant = applicant,
				submitted = int(time.time()),
				filesize=int(os.path.getsize(filename)),
				name=refname,
				institution=refinst,
				email=refemail,
				lastRequested = int(time.time()))
	 

def filename_to_ref_simple(dept, applicant, filename):
	print "  " + filename
	
	user = resume.AuthInfo.cSelectOne(dept,username=applicant.uname)
#	applicant = resume.Applicant.cSelectOne(dept,auth=user)

	refname = "  " + os.path.splitext(os.path.split(filename)[1])[0].replace('_',' ')

	refs = [r for r in resume.Reference.cSelectBy(dept,applicant=applicant)]
	code = applicant.id*10 + len(refs)

	print refname
	print code

	commandstr = "cp " + filename.replace(' ','\ ') + ' ' + str(config.uploadPath) + '/ref-' + str(code) + '-pdf'
	os.system(commandstr)
	return resume.Reference(department=dept,
				code=code,
				applicant=applicant,
				submitted=int(time.time()),
				filesize=int(os.path.getsize(os.path.split(filename)[0])),
				name=refname,
				institution="",
				email="",
				lastRequested=int(time.time()))
				
				

def importReferencesFlat(root_dir):
	dept = resume.DepartmentInfo.selectBy(id=1)[0]
	applicants = [x for x in resume.Applicant.selectBy(department=1)]

	ref_filenames = [f for f in os.listdir(root_dir) if os.path.isfile(os.path.join(root_dir, f))]

	for filename in ref_filenames:
		ref = filename_to_ref_impl(dept, os.path.join(root_dir,filename))
		print ref

def referencesFromDir(dept,applicant,path):
	ref_filenames = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]

	for filename in ref_filenames:
		filename_to_ref_simple(dept, applicant, os.path.join(path,filename))

def importReferencesByDir(root_dir):
	dept = resume.DepartmentInfo.selectBy(id=1)[0]
	applicants = [x for x in resume.Applicant.selectBy(department=1)]

	ref_filenames = [f for f in os.listdir(root_dir) if (not os.path.isfile(os.path.join(root_dir, f)))]

	for applicant in applicants:
		path = os.path.join(root_dir, applicant.uname)
		if(os.path.exists(path) and (not os.path.isfile(path))):
			ref_filenames.remove(applicant.uname)
			print "Files for " + applicant.uname
			referencesFromDir(dept,applicant,path)
		else:
			uname_spaces = applicant.uname.replace('_',' ')
			path = os.path.join(root_dir, uname_spaces)
			if(os.path.exists(path) and (not os.path.isfile(path))):
				#ref_filenames.remove(uname_spaces)
				print "Files for " + applicant.uname
				referencesFromDir(dept,applicant,path)
			else:
				print "No file for " + applicant.uname

	print "Directories that didn't match an applicant (" + str(len(ref_filenames)) + "): " + str(ref_filenames)


def importReferences(root_dir):
	return importReferencesByDir(root_dir)
	
