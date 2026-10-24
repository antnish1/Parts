import { useEffect } from 'react';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/auth/AuthProvider';
import { registerPushToken } from '@/services/notifications';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});

// Runs only while authenticated; never requests permission in the background.
// Expo push requires the native build to contain FCM configuration.
export function PushRegistration(){
 const {profile,isAuthenticated}=useAuth();
 useEffect(()=>{
   const open=(response:Notifications.NotificationResponse)=>{
     const id=response.notification.request.content.data?.orderId;
     if(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id))router.push(`/orders/${id}`);
   };
   const listener=Notifications.addNotificationResponseReceivedListener(open);
   void Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response);}).catch(()=>{});
   return ()=>listener.remove();
 },[]);
 useEffect(()=>{
   if(!isAuthenticated||!profile?.id||Platform.OS!=='android')return;
   let cancelled=false;
   let inFlight=false;
   async function register(){
     if(cancelled||inFlight)return;
     inFlight=true;
     try{
       await Notifications.setNotificationChannelAsync('operations',{name:'Operations',importance:Notifications.AndroidImportance.HIGH,enableVibrate:true});
       const existing=await Notifications.getPermissionsAsync();
       const permission=existing.granted?existing:await Notifications.requestPermissionsAsync();
       if(!permission.granted||cancelled)return;
       const response=await Notifications.getExpoPushTokenAsync({projectId:'3026af5e-622e-48de-bb4f-1ca851373589'});
       if(cancelled)return;
       await registerPushToken(profile!.id,response.data);
       console.info('Parts Connect push device registered');
     }catch(error){
       console.warn('Parts Connect push registration failed; will retry on foreground:',error);
     }finally{inFlight=false;}
   }
   void register();
   // Retry on foreground if FCM/token registration failed at first sign-in.
   const sub=AppState.addEventListener('change',state=>{if(state==='active')void register();});
   return ()=>{cancelled=true;sub.remove();};
 },[isAuthenticated,profile?.id]);
 return null;
}
