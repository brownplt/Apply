serverName = 'http://apply.cs.brown.edu'

resumeRoot = '/home/apply/apply/resume'

usedb = 'mysql' # sqlite3 also works
dbuser = 'apply'
dbpass = 'apply'
dbname = 'apply' # for sqlite3, this is the path

smtpServer='localhost'
smtpUsername=''	#if blank, this will use normal SMTP
smtpPassword='' #given a username and password, SSMTP will be used

#
# The following settings are derived
#

resumeLog = resumeRoot + '/logs/resume.log'
emailLog = resumeRoot + '/logs/email.log'
serverRoot = resumeRoot + '/resume'
uploadPath = resumeRoot + '/uploads' # recommendations, etc. go here
tempPath = resumeRoot + '/temp' # temporary csv's go here



