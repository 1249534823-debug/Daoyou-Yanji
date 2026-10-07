package sbs.yanji.daoyou;

import android.content.Context;
import org.json.JSONObject;
import okhttp3.*;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.util.Locale;
import java.util.concurrent.*;

/** Native API client. Call synchronous methods exclusively off the UI thread. */
public final class GameApi {
    public static final String BASE="https://daoyou.yanji.sbs";
    private static final MediaType JSON=MediaType.get("application/json; charset=utf-8");
    private final SessionVault vault;
    private final OkHttpClient client;
    private final ScheduledExecutorService realtimeExecutor=Executors.newSingleThreadScheduledExecutor();
    private WebSocket socket;
    private boolean realtimeWanted;
    private int generation,retries;
    private long lastMessage;
    private Runnable callback;
    private ScheduledFuture<?> reconnect,watchdog;
    public static class ApiException extends IOException {
        public final int statusCode;
        public ApiException(int code,String message){super(message);statusCode=code;}
    }
    public GameApi(Context context){
        vault=new SessionVault(context);
        client=new OkHttpClient.Builder().cookieJar(vault).followRedirects(false).followSslRedirects(false)
            .connectTimeout(15,TimeUnit.SECONDS).readTimeout(40,TimeUnit.SECONDS).callTimeout(60,TimeUnit.SECONDS)
            .retryOnConnectionFailure(false).build();
    }
    private Request.Builder request(String path)throws Exception{
        if(path==null||!path.startsWith("/api/")||path.contains("\\")||path.contains("#"))throw new ApiException(0,"无效的接口地址");
        HttpUrl url=HttpUrl.get(BASE+path);
        if(!url.isHttps()||!url.host().equals("daoyou.yanji.sbs")||url.port()!=443)throw new ApiException(0,"不允许连接其他服务器");
        return new Request.Builder().url(url).header("Origin",BASE).header("Accept","application/json").header("User-Agent","YanjiNative/1.0 Android");
    }
    public JSONObject get(String path)throws Exception{return execute(request(path).get().build());}
    public JSONObject post(String path,JSONObject body)throws Exception{return execute(request(path).post(RequestBody.create(body.toString(),JSON)).build());}
    private JSONObject execute(Request request)throws Exception{
        if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("操作已取消");
        try(Response response=client.newCall(request).execute()){
            String text=readBounded(response,4*1024*1024);
            JSONObject json;
            try{json=text.trim().isEmpty()?new JSONObject():new JSONObject(text);}catch(Exception e){
                if(text.trim().equals("null")&&response.isSuccessful())return new JSONObject();
                throw new ApiException(response.code(),"服务器返回异常，请稍后重试");
            }
            if(!response.isSuccessful()||json.optBoolean("success",true)==false)throw error(response.code(),json);
            return json;
        }catch(InterruptedIOException e){throw new ApiException(0,Thread.currentThread().isInterrupted()?"操作已取消":"连接超时，请检查网络；提交操作请先刷新确认结果");}
    }
    private static String readBounded(Response response,long limit)throws Exception{
        ResponseBody body=response.body();if(body==null)return "";
        if(body.contentLength()>limit)throw new ApiException(response.code(),"服务器返回内容过大");
        okio.BufferedSource source=body.source();source.request(limit+1);
        if(source.getBuffer().size()>limit)throw new ApiException(response.code(),"服务器返回内容过大");
        return source.readUtf8();
    }
    private static ApiException error(int status,JSONObject value){
        if(status==401)return new ApiException(401,"登录已过期，请重新登录");
        if(status==429)return new ApiException(429,"操作太频繁，请稍后重试");
        String message=value.optString("message",value.optString("error","操作未完成，请稍后重试"));
        if(value.opt("error") instanceof JSONObject)message=value.optJSONObject("error").optString("message","操作未完成，请稍后重试");
        if(message.length()>240||message.contains("<html"))message="服务器暂不可用，请稍后重试";
        return new ApiException(status,message);
    }
    private JSONObject captchaPost(String path,JSONObject body,String action)throws Exception{
        JSONObject challenge=get("/api/captcha/challenge?action="+action);
        String proof=Altcha.solve(challenge);
        return execute(request(path).header("x-altcha-payload",proof).post(RequestBody.create(body.toString(),JSON)).build());
    }
    public JSONObject login(String email,String password)throws Exception{
        return captchaPost("/api/auth/sign-in/email",new JSONObject().put("email",normalize(email)).put("password",password).put("callbackURL",BASE+"/game"),"sign-in");
    }
    public JSONObject sendOtp(String email)throws Exception{
        return captchaPost("/api/auth/email-otp/send-verification-otp",new JSONObject().put("email",normalize(email)).put("type","sign-in"),"email-otp");
    }
    public JSONObject loginOtp(String email,String otp,String name)throws Exception{
        JSONObject body=new JSONObject().put("email",normalize(email)).put("otp",otp.trim());
        if(name!=null&&!name.trim().isEmpty())body.put("name",name.trim());
        return post("/api/auth/sign-in/email-otp",body);
    }
    private static String normalize(String email){return email.trim().toLowerCase(Locale.ROOT);}
    public void logout()throws Exception{try{post("/api/auth/sign-out",new JSONObject());}finally{clearSession();}}
    public void clearSession(){stopRealtime();client.dispatcher().cancelAll();vault.clear();}
    /** Called when leaving a screen to cancel pending HTTP calls. */
    public void cancelRequests(){client.dispatcher().cancelAll();}
    public JSONObject retreat(String action,int years)throws Exception{
        if(!action.equals("cultivate")&&!action.equals("breakthrough"))throw new ApiException(0,"无效的修行操作");
        JSONObject body=new JSONObject().put("action",action);if(action.equals("cultivate"))body.put("years",years);
        Request req=request("/api/cultivator/retreat").header("Accept","text/event-stream").post(RequestBody.create(body.toString(),JSON)).build();
        try(Response res=client.newCall(req).execute()){
            if(!res.isSuccessful())throw error(res.code(),new JSONObject(readBounded(res,65536)));
            if(res.body()==null)throw new ApiException(0,"服务器未返回修行结果，请刷新确认");
            okio.BufferedSource source=res.body().source();StringBuilder event=new StringBuilder();int total=0;
            while(!source.exhausted()){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("操作已取消，请刷新确认结果");
                String line=source.readUtf8LineStrict(65536);total+=line.length();
                if(total>2*1024*1024)throw new ApiException(0,"结果过长，请刷新查看");
                if(line.isEmpty()){
                    if(event.length()>0){
                        JSONObject value=new JSONObject(event.toString());event.setLength(0);
                        if("result".equals(value.optString("type")))return value;
                        if("error".equals(value.optString("type")))throw error(400,value);
                    }
                }else if(line.startsWith("data:")){if(event.length()>0)event.append('\n');event.append(line.substring(5).trim());}
            }
            throw new ApiException(0,"连接中断，请刷新确认修行结果，避免重复提交");
        }
    }
    public synchronized void startRealtime(Runnable onChange){
        callback=onChange;if(realtimeWanted)return;realtimeWanted=true;retries=0;generation++;connect(generation);
    }
    private synchronized void connect(int token){
        if(!realtimeWanted||token!=generation)return;
        try{
            Request req=request("/api/realtime?channels=player-state").build();
            socket=client.newWebSocket(req,new WebSocketListener(){
                @Override public void onOpen(WebSocket ws,Response response){synchronized(GameApi.this){if(token!=generation||!realtimeWanted){ws.cancel();return;}retries=0;lastMessage=System.currentTimeMillis();if(watchdog!=null)watchdog.cancel(false);watchdog=realtimeExecutor.scheduleWithFixedDelay(()->{synchronized(GameApi.this){if(token==generation&&realtimeWanted&&System.currentTimeMillis()-lastMessage>55000){ws.cancel();failed(token);}}},15,15,TimeUnit.SECONDS);}}
                @Override public void onMessage(WebSocket ws,String text){
                    synchronized(GameApi.this){if(token!=generation||!realtimeWanted)return;lastMessage=System.currentTimeMillis();}
                    if(text.length()>262144){ws.cancel();failed(token);return;}
                    try{JSONObject data=new JSONObject(text);String type=data.optString("type");if("ping".equals(type)){ws.send("{\"type\":\"pong\"}");return;}if(type.startsWith("player-state")||"event".equals(type)||"ready".equals(type)){Runnable r; synchronized(GameApi.this){r=callback;}if(r!=null)r.run();}}catch(Exception ignored){}
                }
                @Override public void onFailure(WebSocket ws,Throwable t,Response response){if(response!=null&&response.code()==401){stopRealtime();return;}failed(token);}
                @Override public void onClosing(WebSocket ws,int code,String reason){ws.close(code,null);}
                @Override public void onClosed(WebSocket ws,int code,String reason){failed(token);}
            });
        }catch(Exception e){failed(token);}
    }
    private synchronized void failed(int token){
        if(!realtimeWanted||token!=generation)return;
        if(watchdog!=null){watchdog.cancel(false);watchdog=null;}
        if(reconnect!=null&&!reconnect.isDone())return;
        long seconds=Math.min(60,1L<<Math.min(retries++,6));
        reconnect=realtimeExecutor.schedule(()->{synchronized(GameApi.this){reconnect=null;if(token!=generation||!realtimeWanted)return;if(socket!=null){socket.cancel();socket=null;}generation++;connect(generation);}},seconds,TimeUnit.SECONDS);
    }
    public void close(){stopRealtime();cancelRequests();realtimeExecutor.shutdownNow();client.connectionPool().evictAll();}
    public synchronized void stopRealtime(){realtimeWanted=false;generation++;callback=null;if(reconnect!=null){reconnect.cancel(false);reconnect=null;}if(watchdog!=null){watchdog.cancel(false);watchdog=null;}if(socket!=null){socket.cancel();socket=null;}}
}
