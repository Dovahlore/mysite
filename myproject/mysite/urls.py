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
from dovahbase.views import manga, episode, movie,polish,agent
from dovahride import views as ride
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
                  path("s/agent", agent.agent_page, name="agent_page"),
                  path("s/agent/history", agent.history, name="agent_history"),
                  path("s/agent/chat", agent.chat, name="agent_chat"),

                  # 新增清空历史的路由，替换掉原来的 cancel（如果有 confirm 也一并删掉）
                  path("s/agent/clear", agent.clear_history, name="agent_clear"),
                    # 建议放在一个 base 或 common 的路由组里
                path('base/api/common_ai_polish/', polish.api_common_ai_polish, name='api_common_ai_polish'),

                path("s/base/manga", manga.manga),
                path("base/manga/edit/<id>", manga.manga_edit),
                path("base/manga/new", manga.manga_new),
                path('s/base/manga/list', manga.api_manga_list, name='api_manga_list'),

                path("s/base/episode", episode.episode),
                path("base/episode/edit/<id>", episode.episode_edit),
                path("base/episode/new", episode.episode_new),
                path('s/base/episode/list', episode.api_episode_list, name='api_episode_list'),
                path('base/episode/scrape_episode/', episode.api_scrape_episode, name='api_scrape_epis'   ),

                path("s/base/movie", movie.movie),
                path("base/movie/edit/<id>", movie.movie_edit),
                path("base/movie/new", movie.movie_new),
                path('base/movie/scrape_movie/', movie.api_scrape_movie, name='api_scrape_movie'),
                path('s/base/movie/list', movie.api_movie_list, name='api_movie_list'),

                path('base/proxy_image/', movie.proxy_image, name='proxy_image'),

                path('s/bike/display/<id>',ride.ride_display , name='ride_display'),
                path('s/bike/', ride.ride_wall, name='ride_wall'),
                path('bike/upload/', ride.ride_upload, name='ride_upload'),
                path('bike/manage/', ride.ride_manage, name='ride_manage'),
                path('bike/delete/<id>/', ride.ride_delete, name='ride_delete'),
                path('bike/sync/', ride.request_full_sync, name='ride_sync'),


              ] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
