package sbs.yanji.daoyou;

import android.os.SystemClock;
import android.util.Base64;
import org.json.JSONObject;
import java.io.InterruptedIOException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Implements ALTCHA v2 PBKDF2 proof of work without weakening server validation. */
final class Altcha {
    static String solve(JSONObject challenge) throws Exception {
        JSONObject p=challenge.getJSONObject("parameters");
        if(!"PBKDF2/SHA-256".equals(p.getString("algorithm")))throw new Exception("验证算法暂不支持，请更新客户端");
        int cost=p.getInt("cost"),length=p.getInt("keyLength");
        if(cost<1||cost>10000||length!=32)throw new Exception("验证参数超出安全范围");
        long expiry=p.getLong("expiresAt");
        if(expiry<=System.currentTimeMillis()/1000)throw new Exception("验证已过期，请重试");
        byte[] nonce=hex(p.getString("nonce")),salt=hex(p.getString("salt"));
        String prefix=p.getString("keyPrefix");
        if(nonce.length!=16||salt.length!=16||!prefix.matches("[0-9a-fA-F]{1,64}"))throw new Exception("验证参数无效");
        byte[] password=new byte[nonce.length+4];System.arraycopy(nonce,0,password,0,nonce.length);
        byte[] input=new byte[salt.length+4];System.arraycopy(salt,0,input,0,salt.length);input[input.length-1]=1;
        long start=SystemClock.elapsedRealtime();
        Mac mac=Mac.getInstance("HmacSHA256");
        for(int counter=0;counter<=100000;counter++){
            check(start,expiry);
            int offset=nonce.length;password[offset]=(byte)(counter>>>24);password[offset+1]=(byte)(counter>>>16);password[offset+2]=(byte)(counter>>>8);password[offset+3]=(byte)counter;
            mac.init(new SecretKeySpec(password,"HmacSHA256"));
            byte[] u=mac.doFinal(input),result=u.clone();
            for(int j=1;j<cost;j++){
                if((j&255)==0)check(start,expiry);
                u=mac.doFinal(u);
                for(int k=0;k<32;k++)result[k]^=u[k];
            }
            if(matches(result,prefix)){
                JSONObject solution=new JSONObject().put("counter",counter).put("derivedKey",toHex(result)).put("time",SystemClock.elapsedRealtime()-start);
                return Base64.encodeToString(new JSONObject().put("challenge",challenge).put("solution",solution).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),Base64.NO_WRAP);
            }
        }
        throw new Exception("验证未完成，请重新获取验证");
    }
    private static void check(long start,long expiry)throws Exception{
        if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("验证已取消");
        if(SystemClock.elapsedRealtime()-start>=90000||System.currentTimeMillis()/1000>=expiry)throw new Exception("验证超时，请重试");
    }
    private static boolean matches(byte[] bytes,String prefix){
        for(int i=0;i<prefix.length();i++){int nibble=(i%2==0?(bytes[i/2]&255)>>>4:bytes[i/2]&15);if(nibble!=Character.digit(prefix.charAt(i),16))return false;}
        return true;
    }
    private static byte[] hex(String str)throws Exception{
        if(str.length()%2!=0||str.length()>128)throw new Exception("验证参数无效");
        byte[] data=new byte[str.length()/2];
        for(int i=0;i<data.length;i++){int a=Character.digit(str.charAt(i*2),16),b=Character.digit(str.charAt(i*2+1),16);if(a<0||b<0)throw new Exception("验证参数无效");data[i]=(byte)(a*16+b);}
        return data;
    }
    private static String toHex(byte[] bytes){char[] out=new char[bytes.length*2],digits="0123456789abcdef".toCharArray();for(int i=0;i<bytes.length;i++){out[i*2]=digits[(bytes[i]&255)>>>4];out[i*2+1]=digits[bytes[i]&15];}return new String(out);}
}
