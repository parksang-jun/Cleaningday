package io.github.parksangjun.cleaningday;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 내장 플러그인(랭킹)은 super.onCreate 전에 등록해야 한다
        registerPlugin(LeaderboardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
