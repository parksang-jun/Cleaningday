package io.github.parksangjun.cleaningday;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * 랭킹 (Play 게임 서비스 v2). 웹 쪽 src/leaderboard.ts 가 부른다.
 * res/values/strings.xml 의 game_services_project_id · leaderboard_total_stars 가 비어 있으면
 * (Play Console 설정 전) SDK 를 켜지 않고 모든 호출을 "로그인 안 됨"으로 돌려준다.
 */
@CapacitorPlugin(name = "Leaderboard")
public class LeaderboardPlugin extends Plugin {

    private static final int RC_LEADERBOARD = 9004;
    private boolean ready = false;
    private String boardId = "";

    @Override
    public void load() {
        try {
            String projectId = getContext().getString(R.string.game_services_project_id).trim();
            boardId = getContext().getString(R.string.leaderboard_total_stars).trim();
            if (projectId.isEmpty() || boardId.isEmpty()) return;
            PlayGamesSdk.initialize(getContext());
            ready = true;
        } catch (Exception e) {
            ready = false;
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!ready) {
            answer(call, false);
            return;
        }
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        final GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
        client
            .isAuthenticated()
            .addOnCompleteListener(task -> {
                boolean ok = task.isSuccessful() && task.getResult().isAuthenticated();
                if (ok || !interactive) {
                    answer(call, ok);
                    return;
                }
                client.signIn().addOnCompleteListener(t -> answer(call, t.isSuccessful() && t.getResult().isAuthenticated()));
            });
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        Integer score = call.getInt("score");
        if (!ready || score == null) {
            call.reject("leaderboard not ready");
            return;
        }
        try {
            PlayGames.getLeaderboardsClient(getActivity()).submitScore(boardId, score);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!ready) {
            call.reject("leaderboard not ready");
            return;
        }
        PlayGames
            .getLeaderboardsClient(getActivity())
            .getLeaderboardIntent(boardId)
            .addOnSuccessListener(intent -> {
                try {
                    getActivity().startActivityForResult(intent, RC_LEADERBOARD);
                    call.resolve();
                } catch (Exception e) {
                    call.reject(e.getMessage());
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }

    private void answer(PluginCall call, boolean signedIn) {
        JSObject ret = new JSObject();
        ret.put("signedIn", signedIn);
        call.resolve(ret);
    }
}
