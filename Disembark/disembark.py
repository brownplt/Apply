#!/usr/bin/python

username = 'arjun@cs.brown.edu'
password = 'Ma49Ctq6'

import logging
from xml.etree import ElementTree
import sys
import os.path
import urllib2
import urllib
import time
from cookielib import CookieJar, DefaultCookiePolicy
import string
import json
import anon

anon.ANONIMIZE = False

logging.basicConfig(format='%(message)s')
logger = logging.getLogger('disembark')
logger.setLevel(logging.INFO)


EMBARK_XHR = 'http://manage.embark.com/AjaxHandler.ashx'

cookieJar = CookieJar(DefaultCookiePolicy())
opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cookieJar))
opener.addheaders = \
  [('User-Agent', "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_2) AppleWebKit/535.7 (KHTML, like Gecko) Chrome/16.0.912.63 Safari/535.7"),
   ('Referer', 'http://manage.embark.com')] # it's for security ...


def stamp():
  return str(int(time.time()))

def mfloat(s):
  try:
    return float(s)
  except ValueError:
    return None


def request(url, values={}):
  values = dict(map(lambda(k,v): (k,v.encode('utf-8')), values.iteritems()))
  args = urllib.urlencode(values)
  full_url = '%s?%s' % (url, args)
  req = urllib2.Request(full_url)
  response = opener.open(req)
  if response.code != 200:
    logger.error('%s failed, code=%s, reason=%s' % (full_url, response.code,
                                                       response.reason))
  txt = response.read()
  logger.info('request: %s' % full_url)
  return txt

def post(url, content_type, data):
  req = urllib2.Request(url)
  req.add_header('Content-Type', content_type)
  response = opener.open(req, data)
  return response.read()

logged_in = False
def embark_login():
  global logged_in
  # clear-text credentials in a query string ...
  request(EMBARK_XHR,
          { 'MODE': 'ValidateLoginCredentials',
            'TIMESTAMP': stamp(), 
            'USERNAME': username,
            'PASSWORD': password })
  post(EMBARK_XHR, 'application/xml', '<?xml version="1.0" encoding="UTF-8"?><XR><MODE v="SubmitSearch"></MODE><SCRX><POI v="14"></POI></SCRX><TIMESTAMP v="%s"></TIMESTAMP></XR>' % stamp())
  logged_in = True

def embark_xhr(values={}):
  global logged_in
  if logged_in == False:
    embark_login()
  return request(EMBARK_XHR, values)

def embark_doc_url(doc_id, rec_id=None):
  if doc_id == None:
    return None

  doc_id = doc_id.encode('utf-8', 'backslashreplace')

  if rec_id == None:
    args = { 
      'DocumentFileId': doc_id, 
      'IsRecommendationDocument': 'false' 
    }
  else:
    args = { 
      'DocumentFileId': doc_id, 
      'IsRecommendationDocument': 'true',
      'RecommenderId': rec_id 
    }
  return 'http://manage.embark.com/DocumentHandler.aspx?%s' % urllib.urlencode(args)

def embark_detail_url(embark_id):
  args = {
    'MODE': 'GetClientXMLs',
    'DUID': embark_id,
    'TIMESTAMP': stamp()
  }
  return "%s?%s" % (EMBARK_XHR, urllib.urlencode(args))

#
# Real stuff
#

areas = {
  1: "Algorithms",
  2: "Artificial Intelligence",
  3: "Bioinformatics and Computational Biology",
  4: "Computer Vision",
  5: "Cryptography",
  6: "Databases",
  7: "General",
  8: "Graphics",
  9: "HCI",
  10: "Languages",
  11: "Machine Learning",
  12: "Natural Language Processing",
  13: "Networks",
  14: "Operating Systems",
  15: "Programming",
  16: "Robotics",
  17: "Security",
  18: "Software Engineering",
  19: "Systems",
  20: "Theory",
  21: "Visualization"
}

# etree bug: can't handle underscores in tag-names
def custom_find(x, tagName):
  for elt in x.getiterator():
    if elt.tag == tagName:
      return elt
  return None


class JSONEncoder(json.JSONEncoder):
  def default(self, obj):
    if isinstance(obj, Student):
      return obj.toJSON()
    return json.JSONEncoder.default(self, obj)

class Student(object):

  current_embark_id = None
  current_recommender_id = None
  primed_docs = { }

  def __getXml__(self, field_name):
    r = self.__xml__.find(field_name)
    if (r != None):
      r = r.get('v')
    if (r == None):
      logger.warning('no field %s for %s' % (field_name, self))
    return r

  def __get_fuid__(self, abbr, single=True):
    r = [ elt.get('fuid') for elt in self.__detail_fields__ 
                          if elt.get('abbr') == abbr ]
    if single == True:
      if len(r) == 1:
        return r[0]
      else:
        logger.warning('no fuid %s for %s (found %s)' % (abbr, self, r))
        return None
    else:
      return r

  def __request_details__(self):
    path = "data/detail-%s.xml" % self.embark_id
  
    if not os.path.exists(path):
      logger.info('%s : downloading recommendation XML' % self)
      data = embark_xhr({ 'MODE': 'GetClientXMLs',
                           'DUID': self.embark_id,
                           'TIMESTAMP': stamp() })
      Student.current_embark_id = self.embark_id # server state!
      handle = open(path, 'w')
      handle.write(data)
      handle.close()
    
    self.__detail_xml__ = ElementTree.parse(path)
    self.__detail_fields__ = self.__detail_xml__.findall('.//FIELD')

    # Calculating areas
    areas_str = custom_find(self.__detail_xml__, 'FD_410')
    if areas_str == None:
      areas_str = ''
    else:
      areas_str = areas_str.get('v')
    self.areas = []
    try:
      self.areas = [ areas[int(index)] for index in areas_str.split(',') ]
    except ValueError as e:
      logger.warning('Cannot parse area for %s (%s)' % (self, areas_str))
    except KeyError as e:
      logger.warning('Invalid area for %s (%s)' % (self, areas_str))
    
    # Two-step process for getting transcripts, &c.
    self.__cv_fuid__ = self.__get_fuid__('FD_339')
    self.__personal_statement_fuid__ = self.__get_fuid__('FD_345')
    self.__transcript_fuids__ = self.__get_fuid__('FD_347',False)
    self.__writing_sample_fuid__ = self.__get_fuid__('FD_344')

  def __init__(self, x):
    self.__xml__ = x
    self.first_name = self.last_name = self.embark_id = None # needed by __str__
    self.embark_id = x.get('id')
    if (self.embark_id == None):
      logger.error('no ID on %s' % x)
    self.first_name = self.__getXml__('FNA')
    self.last_name = self.__getXml__('LNA')
    self.email = self.__getXml__('EAD')
    self.GPA = self.__getXml__('GPA')
    self.GRE_math = self.__getXml__('TSQ')
    self.GRE_verbal = self.__getXml__('TSV')
    self.country = self.__getXml__('CZN')

    self.__request_details__()

  def toJSON(self):
    return {
      'embarkId': self.embark_id,
      'firstName': anon.first_name(self.first_name),
      'lastName': anon.last_name(self.last_name),
      'email': anon.email(self.email),
      'GPA': anon.gpa(mfloat(self.GPA)),
      'GREMath': anon.gre(mfloat(self.GRE_math)),
      'GREVerbal': anon.gre(mfloat(self.GRE_verbal)),
      'country': self.country,
      'areas': self.areas,
      'materials': \
        [ { 'text': 'Statement',
            'url': anon.transcript(u) } for u in self.personal_statement_files]+
        [ { 'text': 'Writing Sample',
            'url': anon.cv(u) } for u in self.writing_sample_files ] +
        [ { 'text': 'CV', 'url': anon.cv(u) } for u in self.cv_files ] +
        [ { 'text': 'Transcript', 'url': anon.cv(u) }
          for u in self.transcript_files ],
      'recs': [ { 'text': 'Recommendation %s' % ix,
                  'url': anon.transcript(u) }
                for (u,  ix) in zip(self.rec_files,
                                        range(1, len(self.rec_files) + 1))
              ],
      'expectedRecCount': int(self.expected_rec_count),
    }

  def set_server_state(self):
    if Student.current_embark_id != self.embark_id:
      embark_xhr({ 'MODE': 'GetClientXMLs',
                    'DUID': self.embark_id,
                    'TIMESTAMP': stamp() })
      Student.current_embark_id = self.embark_id
      Student.current_recommender_id = None
      Student.primed_docs = { }

  def set_recommender_state(self):
    if Student.current_recommender_id != self.embark_id:
      data = embark_xhr({ 'MODE': 'GetRecommendationsForDRID',
                           'DRID': self.embark_id,
                           'ACID': '10',
                           'TIMESTAMP': stamp() })
      Student.current_recommender_id = self.embark_id

  def __str__(self):
    return "%s, %s (ID: %s)" % (self.first_name, self.last_name, self.embark_id)

  def get_recommendation_filenames(self):
    path = "data/recs-%s.xml" % self.embark_id

    if not os.path.exists(path):
      logger.info('%s : downloading recommendation XML' % self)
      self.set_server_state()
      data = embark_xhr({ 'MODE': 'GetRecommendationsForDRID',
                          'DRID': self.embark_id,
                          'ACID': '10',
                          'TIMESTAMP': stamp() })
      Student.current_recommender_id = self.embark_id
      handle = open(path, 'w')
      handle.write(data)
      handle.close()

    xml = ElementTree.parse(path)
    ids = [ x.get('recommender_id') for x in xml.getiterator() 
                                              if x.tag == 'CD_182' ]
    fuids = [ x.get('fuid') for x in xml.getiterator()
                                      if x.tag == 'FIELD' and \
                                         x.get('abbr') == 'FD_383' ]
    if (len(ids) != len(fuids)):
      logger.log('%s : mismatched lengths in recs. %s %s' % (self, ids, fuids))

    ids_and_fuids = zip(ids, fuids)
    recs = []
    for rec_id, rec_fuid in ids_and_fuids:
      path = "data/recinfo-%s-%s.xml" % (self.embark_id, rec_id)
      if not os.path.exists(path):
        logger.info('%s : downloading rec. filenames for %s' % (self, rec_id))
        self.set_server_state()
        data = embark_xhr({
          'MODE': 'GetUploadedFilesForUser',
          'FUID': rec_fuid,
          'IsRecommendationDocument': 'true',
          'RecommenderId': rec_id,
          'TIMESTAMP': stamp()
        })
        handle = open(path, 'w')
        handle.write(data)
        handle.close()
      xml = ElementTree.parse(path)
      these_recs = [ (f.get('n'), rec_id) for f in xml.findall('.//FILE') ]
      logger.info('%s filenames in %s' % (len(these_recs), path))
      recs = recs + these_recs

    for doc_id, _ in recs:
      Student.primed_docs[doc_id] = True
    
    self.__recs__ = recs
    self.expected_rec_count = len(ids_and_fuids)
      

  def get_fuid_files(self, fuid, single=True):
    path = "data/fuid-%s-%s.xml" % (self.embark_id, fuid)

    if not os.path.exists(path):
      logger.info('%s : downloading file list for %s' % (self, fuid))
      self.set_server_state()
      self.set_recommender_state()
      fuid_data = embark_xhr({
                    'MODE': 'GetUploadedFilesForUser',
                    'FUID': fuid,
                    'IsRecommendationDocument': 'false',
                    'RecommenderId': '-1',
                    'TIMESTAMP': stamp()
                  })
      handle = open(path, 'w')
      handle.write(fuid_data)
      handle.close()

    try:
      fs = [ f.get('n') for f in ElementTree.parse(path).findall('.//FILE') ]
    except ElementTree.ParseError:
      logger.warning('%s : could not parse %s' % (self, path))
      fs = []

    for doc_id in fs:
      Student.primed_docs[doc_id] = False

    if single:
      if len(fs) != 1:
        logger.warning('%s : got %s files for %s (%s)' % (self, len(fs), fuid, fs))
        return None
      else:
        return fs[0]
    else:
      return fs

  def get_upload_filenames(self):
    self.__cv_files__ = self.get_fuid_files(self.__cv_fuid__,False)
    self.__transcript_files__ = \
      sum([self.get_fuid_files(f,False) for f in self.__transcript_fuids__ ],[])
    self.__personal_statement_files__ = \
      self.get_fuid_files(self.__personal_statement_fuid__, False)
    self.__writing_sample_files__ = \
      self.get_fuid_files(self.__writing_sample_fuid__, False)

  def prime_doc(self, doc_id, is_rec):
    if Student.primed_docs.has_key(doc_id):
      return

    if is_rec:
      return
    else:
      embark_xhr({
        'MODE': 'GetUploadedFilesForUser',
        'FUID': doc_id,
        'IsRecommendationDocument': 'false',
        'RecommenderId': '-1',
        'TIMESTAMP': stamp()
      })
      Student.primed_docs[doc_id] = True


  def __download__(self, friendly, doc_id, rec_id=None):
    if doc_id == None:
      return None
    path = "docs/%s-%s-%s" % (self.embark_id, friendly, doc_id)
    path = path.encode('ascii', 'ignore')
    if not os.path.exists(path):
      self.set_server_state()
      self.set_recommender_state()
      logger.info('%s : downloading %s' % (self, doc_id))
      if rec_id == None:
        args = { 'DocumentFileId': doc_id, 'IsRecommendationDocument': 'false' }
      else:
        args = { 'DocumentFileId': doc_id, 'IsRecommendationDocument': 'true',
                 'RecommenderId': rec_id }
      data = request('http://manage.embark.com/DocumentHandler.aspx', args)
      handle = open(path, 'wb')
      handle.write(data)
      handle.close()
    return path[5:]

  def download_docs(self):
    self.get_recommendation_filenames()
    self.get_upload_filenames()
    self.cv_files = \
      [ self.__download__('CV', t) for t in self.__cv_files__ ]
    self.personal_statement_files = \
      [ self.__download__('Statement',t) for t in  self.__personal_statement_files__ ]
    self.writing_sample_files =  \
      [ self.__download__('Sample', t) for t in self.__writing_sample_files__ ]
    self.transcript_files = \
      [ self.__download__('Transcript-%s' % i, t)
          for i, t in zip(range(0,len(self.__transcript_files__)),
                          self.__transcript_files__) ]
    self.rec_files = \
      [ self.__download__('Rec-%s-%s' % (doc_id, rec_id), doc_id, rec_id) 
          for doc_id, rec_id in self.__recs__ ]


def disembark(path):
  if not os.path.exists(path):
    v = embark_xhr({ 'MODE': 'FetchSearchResultSet', 'undefined': stamp() })
    handle = open(path, 'w')
    handle.write(v)
    handle.close()
    
  xml = ElementTree.parse(path)
  return [ Student(student_xml) for student_xml in xml.findall('SMY') ]



students = { }
def go():
  xml = disembark('data/student-list.xml')
  for s in xml:
    students[s.embark_id] = s  
    s.get_upload_filenames()
    s.get_recommendation_filenames()

def dump_json(path):
  h = open(path, 'w')
  h.write(json.dumps(students.values(), cls=JSONEncoder))
  h.close();

if __name__ == "__main__":
  go()
  logger.info("Now downloading documents ...")
  for s in students.values():
    s.download_docs()
  dump_json('client/data.js')
