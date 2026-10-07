package sbs.yanji.daoyou;
import android.app.*;import android.content.*;import android.os.*;import android.graphics.Bitmap;import android.view.*;import android.widget.*;import org.json.*;import java.lang.reflect.*;import java.io.*;import java.util.*;
/** Isolated test APK only. Fixture UI is never shipped or sent to production. */
public final class SmokeInstrumentation extends Instrumentation {
 private MainActivity activity;private File folder;private int assertions=0;
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 private void check(boolean b,String m){if(!b)throw new AssertionError(m);assertions++;}
 private void invoke(String name)throws Exception{Method m=MainActivity.class.getDeclaredMethod(name);m.setAccessible(true);m.invoke(activity);}
 private void field(String name,Object value)throws Exception{Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);f.set(activity,value);}
 private void ui(Throwing run){runOnMainSync(()->{try{run.run();}catch(Exception e){throw new RuntimeException(e);}});}
 interface Throwing{void run()throws Exception;}
 private void shot(String name)throws Exception{waitForIdleSync();Thread.sleep(700);Bitmap b=getUiAutomation().takeScreenshot();check(b!=null,"screenshot");try(FileOutputStream out=new FileOutputStream(new File(folder,name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}b.recycle();}
 @Override public void onStart(){Bundle result=new Bundle();try{
   folder=new File(getTargetContext().getExternalFilesDir(null),"native-smoke");folder.mkdirs();
   // Compute a deterministic PBKDF2 vector independent of the production challenge.
   String nonce="80ff02030405060708090a0b0c0d0e0f",salt="000102030405060708090a0b0c0d0e0f";
   JSONObject p=new JSONObject().put("algorithm","PBKDF2/SHA-256").put("nonce",nonce).put("salt",salt).put("keyLength",32).put("cost",2).put("keyPrefix","VECTOR").put("expiresAt",System.currentTimeMillis()/1000+60);
   // Prefix and expected vector substituted by the independent Python generator.
   p.put("keyPrefix","ec392adfc9f7582abf3d65457aabd50390c1f01f4d69249f9b4105cae1aa6116");String proof=Altcha.solve(new JSONObject().put("parameters",p));
   JSONObject solved=new JSONObject(new String(android.util.Base64.decode(proof,0),"UTF-8"));check(solved.getJSONObject("solution").getInt("counter")==0,"PBKDF2 binary password vector");
   GameApi api=new GameApi(getTargetContext());JSONObject session=api.get("/api/auth/get-session");check(!session.has("user"),"clean unauthenticated session");
   try{api.get("/api/player/resources?keys=profile");throw new AssertionError("private API accepted anonymous");}catch(GameApi.ApiException e){check(e.statusCode==401,"unauthenticated resource denied");}
   activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));Thread.sleep(4000);
   ui(()->{field("busy",false);invoke("loginScreen");});shot("01-login");
   JSONObject resources=new JSONObject();
   resources.put("profile",new JSONObject().put("data",new JSONObject().put("cultivator",new JSONObject().put("name","测试角色·长中文姓名").put("realm","筑基").put("realm_stage","中期").put("age",38).put("lifespan",200))));
   resources.put("condition",new JSONObject().put("data",new JSONObject().put("resources",new JSONObject().put("hp",new JSONObject().put("current",1834)).put("mp",new JSONObject().put("current",788)))));
   resources.put("progress",new JSONObject().put("data",new JSONObject().put("cultivation_exp",2500).put("exp_cap",2500)));
   resources.put("currency",new JSONObject().put("data",new JSONObject().put("qi",200).put("spiritStones",9650000)));
   ui(()->{field("resources",resources);field("signedIn",true);invoke("navigation");invoke("home");});shot("02-home-fixture");
   ui(()->invoke("retreatScreen"));shot("03-retreat-fixture");
   ui(()->{Method m=MainActivity.class.getDeclaredMethod("detail",JSONObject.class,String.class);m.setAccessible(true);m.invoke(activity,new JSONObject().put("name","青冥剑").put("quality","神品").put("description","雷光凝于剑锋，护持修士周身。此为测试展示数据。"),"artifacts");});shot("04-item-sheet-fixture");
   result.putString("stream","PASS "+assertions+" assertions; fixture screens explicitly labelled; no production writes");finish(Activity.RESULT_OK,result);
 }catch(Throwable t){result.putString("stream","FAIL "+t.toString());finish(Activity.RESULT_CANCELED,result);}}
}
