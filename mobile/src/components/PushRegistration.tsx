import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/auth/AuthProvider';
import { registerPushToken } from '@/services/notifications';

// Runs only while authenticated; never requests permission in the background.
// Expo push requires the native build to contain FCM configuration.
export function PushRegistration(){
 const {profile,isAuthenticated}=useAuth();
 useEffect(()=>{
   if(!isAuthenticated||!profile?.id||Platform.OS!=='android')return;
   let cancelled=false;
   let registered:string|null=null;
   async function register(){
     try{
       await Notifications.setNotificationChannelAsync('operations',{name:'Operations',importance:Notifications.AndroidImportance.HIGH});
       const existing=await Notifications.getPermissionsAsync();
       const permission=existing.granted?existing:await Notifications.requestPermissionsAsync();
       if(!permission.granted||cancelled)return;
       const projectId='3026af5e-622e-48de-bb4f-1ca851373589';
       const response=await Notifications.getExpoPushTokenAsync({projectId});
       if(cancelled)return;
       registered=response.data;
       await registerPushToken(profile!.id,response.data);
     }catch(error){console.warn('Push registration unavailable:',error);}
   }
   void register();
   return ()=>{cancelled=true;/* Account-switch cleanup is handled separately from this registration lifecycle. */};
 },[isAuthenticated,profile?.id]);
 return null;
}
