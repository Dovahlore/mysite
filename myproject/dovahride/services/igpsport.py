import json
import shutil
import urllib.error
import urllib.parse
import urllib.request


class IGPSportError(RuntimeError):
    pass


class IGPSportClient:
    BASE_URL = "https://prod.zh.igpsport.com/service"

    def __init__(self, username, password, timeout=30):
        self.username = username
        self.password = password
        self.timeout = timeout
        self.token = None

    def _request_json(self, url, *, data=None, authorized=True):
        headers = {
            "Accept": "application/json",
            "User-Agent": "dovahride-sync/1.0",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"
        if authorized:
            if not self.token:
                raise IGPSportError("iGPSPORT client is not authenticated.")
            headers["Authorization"] = f"Bearer {self.token}"

        request = urllib.request.Request(url, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise IGPSportError(f"iGPSPORT request failed: {exc}") from exc

        if payload.get("code") != 0:
            raise IGPSportError(
                f"iGPSPORT API rejected the request: {payload.get('message', 'unknown error')}"
            )
        return payload.get("data")

    def login(self):
        body = json.dumps(
            {
                "username": self.username,
                "password": self.password,
                "appId": "igpsport-web",
            }
        ).encode("utf-8")
        data = self._request_json(
            f"{self.BASE_URL}/auth/account/login",
            data=body,
            authorized=False,
        )
        try:
            self.token = data["access_token"]
        except (TypeError, KeyError) as exc:
            raise IGPSportError("iGPSPORT login response has no access token.") from exc

    def list_activities(self, begin_date, end_date):
        if not self.token:
            self.login()

        page = 1
        while True:
            params = urllib.parse.urlencode(
                {
                    "pageNo": page,
                    "pageSize": 20,
                    "reqType": 0,
                    "sort": 1,
                    "beginTime": begin_date.isoformat(),
                    "endTime": end_date.isoformat(),
                }
            )
            data = self._request_json(
                f"{self.BASE_URL}/web-gateway/web-analyze/activity/queryMyActivity?{params}"
            ) or {}
            rows = data.get("rows") or []
            yield from rows

            if not rows or page >= int(data.get("totalPage") or 1):
                break
            page += 1

    def get_download_url(self, ride_id):
        data = self._request_json(
            f"{self.BASE_URL}/web-gateway/web-analyze/activity/getDownloadUrl/{ride_id}"
        )
        if isinstance(data, str):
            return data
        if isinstance(data, dict):
            return data.get("downloadUrl") or data.get("url")
        return None

    def download_to(self, url, destination):
        if not url:
            raise IGPSportError("iGPSPORT returned an empty download URL.")

        request = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.token}",
                "User-Agent": "dovahride-sync/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                with open(destination, "wb") as output:
                    shutil.copyfileobj(response, output)
        except (OSError, urllib.error.URLError, TimeoutError) as exc:
            raise IGPSportError(f"Could not download ride file: {exc}") from exc
