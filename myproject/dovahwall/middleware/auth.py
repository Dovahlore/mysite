import requests
from django.utils.deprecation import MiddlewareMixin
from django.shortcuts import render, HttpResponse,redirect

class Authorization(MiddlewareMixin):
    def process_request(self,request):
        if request.path_info.find("media/")!=-1 or  request.path_info.find("s/")!=-1or request.path_info=="/":
            return
        info_dict=request.session.get('info')
        if request.path_info=='/':
            return redirect("/s/wall")
        if info_dict:
            return
        else:
            return redirect("/s/login?next=%s"%request.path)