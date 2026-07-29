CREATE USER IF NOT EXISTS 'dovah_agent_ro'@'%'
IDENTIFIED BY 'ru39irpaoskcpask';

GRANT SELECT ON mysite.dovahbase_episode TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_manga TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_manga_tag TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_manga_tags TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_movie TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_movie_tag TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahbase_movie_tags TO 'dovah_agent_ro'@'%';

GRANT SELECT ON mysite.dovahride_ride TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahride_ridesyncrequest TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahride_ridesyncstate TO 'dovah_agent_ro'@'%';

GRANT SELECT ON mysite.dovahwall_admin TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahwall_photo TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahwall_photo_tags TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahwall_tag TO 'dovah_agent_ro'@'%';

FLUSH PRIVILEGES;
