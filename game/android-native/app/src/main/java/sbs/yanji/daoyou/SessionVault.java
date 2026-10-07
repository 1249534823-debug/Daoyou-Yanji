package sbs.yanji.daoyou;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;

/** Encrypted, origin-scoped session storage. Passwords are never stored. */
final class SessionVault implements CookieJar {
    private static final String ALIAS="yanji.session.v1";
    private final SharedPreferences prefs;
    private final List<Cookie> cookies=new ArrayList<>();
    SessionVault(Context context) {
        prefs=context.getApplicationContext().getSharedPreferences("session-v1",Context.MODE_PRIVATE);
        try {
            String raw=prefs.getString("sealed",null);
            if(raw!=null){
                byte[] data=Base64.decode(raw,Base64.NO_WRAP);
                if(data.length<29)throw new Exception("Invalid session");
                Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
                c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,data,0,12));
                JSONArray values=new JSONArray(new String(c.doFinal(data,12,data.length-12),java.nio.charset.StandardCharsets.UTF_8));
                HttpUrl url=HttpUrl.get(GameApi.BASE);
                for(int i=0;i<values.length();i++){
                    Cookie cookie=Cookie.parse(url,values.getString(i));
                    if(cookie!=null&&cookie.matches(url)&&cookie.expiresAt()>System.currentTimeMillis())cookies.add(cookie);
                }
            }
        }catch(Exception e){clear();}
    }
    private SecretKey key() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private void persist(){
        try{
            JSONArray data=new JSONArray();
            for(Cookie cookie:cookies)if(cookie.expiresAt()>System.currentTimeMillis())data.put(cookie.toString());
            Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());
            byte[] encrypted=c.doFinal(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] joined=new byte[c.getIV().length+encrypted.length];
            System.arraycopy(c.getIV(),0,joined,0,c.getIV().length);System.arraycopy(encrypted,0,joined,c.getIV().length,encrypted.length);
            if(!prefs.edit().putString("sealed",Base64.encodeToString(joined,Base64.NO_WRAP)).commit())throw new Exception("Storage failed");
        }catch(Exception e){prefs.edit().remove("sealed").commit();}
    }
    @Override public synchronized void saveFromResponse(HttpUrl url,List<Cookie> received){
        if(!url.isHttps()||!url.host().equals("daoyou.yanji.sbs"))return;
        for(Cookie cookie:received){
            if(!cookie.matches(url))continue;
            cookies.removeIf(old->old.name().equals(cookie.name())&&old.domain().equals(cookie.domain())&&old.path().equals(cookie.path()));
            if(cookie.expiresAt()>System.currentTimeMillis())cookies.add(cookie);
        }
        persist();
    }
    @Override public synchronized List<Cookie> loadForRequest(HttpUrl url){
        List<Cookie> result=new ArrayList<>();
        if(!url.isHttps()||!url.host().equals("daoyou.yanji.sbs"))return result;
        cookies.removeIf(c->c.expiresAt()<=System.currentTimeMillis());
        for(Cookie cookie:cookies)if(cookie.matches(url))result.add(cookie);
        return result;
    }
    synchronized void clear(){cookies.clear();prefs.edit().clear().commit();}
}
