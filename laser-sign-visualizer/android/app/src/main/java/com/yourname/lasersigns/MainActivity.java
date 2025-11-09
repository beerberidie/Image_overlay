package com.yourname.lasersigns;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge display for Samsung Galaxy S20+ compatibility
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
