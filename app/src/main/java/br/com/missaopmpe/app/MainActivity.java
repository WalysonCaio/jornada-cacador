package br.com.missaopmpe.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://pmpe-jornada-cacador.j32341472.chatgpt.site";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openStudyPlatform();
    }

    private void openStudyPlatform() {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL));
            startActivity(fallback);
        }
        finish();
    }
}
