from django.test import TestCase
from datetime import datetime
# Create your tests here.
str="2012-1"
a=datetime(str)
print(a.strftime('%Y-%m'))