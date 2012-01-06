import babies
import random

ANONIMIZE = False

def first_name(name):
  if ANONIMIZE and name != None:
    return random.choice(babies.first_names)
  else:
    return name

def last_name(name):
  if ANONIMIZE and name != None:
    return random.choice(babies.last_names)
  else:
    return name

def transcript(url):
  if ANONIMIZE and url != None:
    return 'http://www.cs.brown.edu/~arjun/silly/asb-transcript.pdf'
  else:
    return url

def cv(url):
  if ANONIMIZE:
    return 'http://www.cs.brown.edu/~arjun/silly/asb-resume.pdf'
  else:
    return url

def gpa(num):
  if ANONIMIZE and num != None:
    return random.uniform(num * 0.90, num * 1.1)
  else:
    return num

def gre(num):
  if ANONIMIZE and num != None:
    if num > 170:
      return int(random.uniform(200, 800))
    else:
      return int(random.uniform(130, 170))
  else:
    return num

def email(addr):
  if ANONIMIZE and addr != None:
    return 'goingonit@gmail.com'
  else:
    return addr
