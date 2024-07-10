"""
URL configuration for mysite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from dovahwall.views import account, wall, upload, organize, main
from dovahbase.views import main as base_main
from dovahbase.views import manga, episode,movie
from django.conf.urls.static import static
from django.views.generic.base import RedirectView
from dovahwall import tests

urlpatterns = [
                  path("s/login", account.login),
                  path("s/check/code", account.image_code),
                  path("s/wall", wall.wall),
                  path("organize", organize.organize),
                  path("edit/item/<id>", organize.edit),
                  path("s/like", wall.like),
                  path("admin/", admin.site.urls),
                  path("upload", upload.upload),
                  path("s/test", tests.test_cache),
                  path("", main.main, name='mainpage'),
                  path("s/base", base_main.main),
                  path("base/manga", manga.manga),
                  path("base/manga/edit/<id>", manga.manga_edit),
                  path("base/manga/new", manga.manga_new),
                  path("base/episode", episode.episode),
                  path("base/episode/edit/<id>", episode.episode_edit),
                  path("base/episode/new", episode.episode_new),
                  path("base/movie", movie.movie),
                  path("base/movie/edit/<id>", movie.movie_edit),
                  path("base/movie/new", movie.movie_new),

              ] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
