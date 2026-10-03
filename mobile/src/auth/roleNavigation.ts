import type { UserRole } from '@/types/auth';

export type WorkAction = { key:string; label:string; description:string; href?:string; badgeKey?:'orders'|'pendingApproval' };
const trackOrders:WorkAction={key:'track-orders',label:'Track Orders',description:'Search and follow order status, parts and activity.',href:'/orders',badgeKey:'orders'};
const pendingIssue:WorkAction={key:'pending-issue',label:'Pending Issue',description:'Receive-complete customer orders waiting for final issue.',href:'/orders/pending-issue'};
const delayedVor:WorkAction={key:'delayed-vor',label:'Delayed VOR',description:'Monitor processed/partially dispatched VOR aging.',href:'/orders/delayed-vor'};
const docket:WorkAction={key:'docket',label:'Docket Scanner',description:'Scan/search a docket and receive billed rows.',href:'/docket'};
const partLocation:WorkAction={key:'part-location',label:'Part Location Finder',description:'Find physical rack/bin locations for a part.',href:'/parts/location'};
const credit:WorkAction={key:'credit',label:'Credit Dispatch',description:'Credit approvals, recovery status and customer requests.',href:'/credit-dispatch'};
const tada:WorkAction={key:'tada',label:'TA/DA Tracking',description:'Track physical SVR custody through HQ and Accounts.',href:'/ta-da'};
const installations:WorkAction={key:'installations',label:'Engine & Breaker',description:'Invoice intake, installation completion and acceptance.',href:'/installations'};
const reports:WorkAction={key:'reports',label:'Reports',description:'Operational order summaries with branch and status drill-down.',href:'/reports'};
const managerDashboard:WorkAction={key:'manager-dashboard',label:'Manager Dashboard',description:'Part-wise inventory position and received/issued movement.',href:'/manager'};
export const roleWorkActions:Record<UserRole,WorkAction[]>={
 branch:[{key:'new-order',label:'New Order',description:'Create a parts order with machine and part master lookup.',href:'/orders/new'},trackOrders,pendingIssue,delayedVor,docket,partLocation,installations,credit,tada],
 admin:[{key:'admin-queue',label:'Approved Orders',description:'Process approved orders or reject them with the protected admin workflow.',href:'/admin/approved'},trackOrders,pendingIssue,delayedVor,docket,partLocation,installations,credit,reports],
 super:[{key:'approval-queue',label:'Approval Queue',description:'Review orders assigned for approval.',href:'/approvals',badgeKey:'pendingApproval'},trackOrders,delayedVor,docket,partLocation,installations,credit,reports],
 manager:[{key:'approval-queue',label:'Manager Approvals',description:'Review escalated approvals.',href:'/approvals',badgeKey:'pendingApproval'},trackOrders,pendingIssue,delayedVor,managerDashboard,docket,partLocation,installations,credit,tada,reports],
 viewer:[trackOrders,delayedVor,partLocation,installations,reports],
 developer:[{key:'approval-queue',label:'Approval Queue',description:'Privileged review access using audited backend functions.',href:'/approvals',badgeKey:'pendingApproval'},{key:'admin-queue',label:'Approved Orders',description:'Process approved orders through the admin Edge Function.',href:'/admin/approved'},trackOrders,pendingIssue,delayedVor,managerDashboard,docket,partLocation,installations,credit,tada,reports,{key:'developer',label:'Developer Workspace',description:'Privileged tools and audited overrides.'}],
 hq:[trackOrders,pendingIssue,delayedVor,partLocation,installations,tada,reports],
 accounts:[{...tada,label:'TA/DA Receipts',description:'Receive eligible SVRs at Accounts.'},{...credit,description:'Review Accounts-stage credit requests and recovery status.'}],
};
