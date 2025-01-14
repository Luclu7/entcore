import { Injectable } from '@angular/core';
import { CommunicationRule } from './communication-rules.component';
import { GroupModel, InternalCommunicationRule } from '../../core/store/models';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/do';
import 'rxjs/add/observable/forkJoin';

interface CreateCommunicationResponseWithChange {
    [groupId: number]: string;
}


interface CreateCommunicationResponseWithNoChange {
    ok: 'no direction to change';
}

type CreateCommunicationResponse = CreateCommunicationResponseWithChange | CreateCommunicationResponseWithNoChange;

function isNoDirectionChangeResponse(response: CreateCommunicationResponse): response is CreateCommunicationResponseWithNoChange {
    return response['ok'] === 'no direction to change';
}

@Injectable()
export class CommunicationRulesService {

    private rulesSubject: Subject<CommunicationRule[]> = new Subject<CommunicationRule[]>();
    private rulesObservable: Observable<CommunicationRule[]> = this.rulesSubject.asObservable();
    private currentRules: CommunicationRule[];

    constructor(private http: HttpClient) {
        this.rulesObservable.subscribe(cr => this.currentRules = cr);
    }

    public changes(): Observable<CommunicationRule[]> {
        return this.rulesObservable;
    }

    public setGroups(groups: GroupModel[]) {
        Observable.forkJoin(...groups.map(group => this.getCommunicationRulesOfGroup(group)))
            .subscribe((communicationRules: CommunicationRule[]) => this.rulesSubject.next(communicationRules));
    }

    public toggleInternalCommunicationRule(group: GroupModel): Observable<InternalCommunicationRule> {
        let request: Observable<{ users: InternalCommunicationRule | null }>;
        const direction: InternalCommunicationRule = group.internalCommunicationRule === 'BOTH' ? 'NONE' : 'BOTH';

        if (direction === 'BOTH') {
            request = this.http.post<{ users: InternalCommunicationRule | null }>(`/communication/group/${group.id}/users`, null);
        } else {
            request = this.http.delete<{ users: InternalCommunicationRule | null }>(`/communication/group/${group.id}/users`);
        }

        return request
            .map(resp => resp.users ? resp.users : 'NONE')
            .do((internalCommunicationRule) => {
                if (this.currentRules) {
                    const groupsInCommunicationRules = this.findGroups(this.currentRules, group.id);
                    if (groupsInCommunicationRules.length > 0) {
                        groupsInCommunicationRules.forEach(group => group.internalCommunicationRule = internalCommunicationRule);
                        this.rulesSubject.next(this.clone(this.currentRules));
                    }
                }
            });
    }

    public removeCommunication(sender: GroupModel, receiver: GroupModel): Observable<void> {
        return this.http.delete<void>(`/communication/group/${sender.id}/relations/${receiver.id}`)
            .do(() => {
                if (this.currentRules) {
                    const communicationRuleOfSender = this.currentRules.find(cr => cr.sender.id === sender.id);
                    if (!!communicationRuleOfSender) {
                        communicationRuleOfSender.receivers = communicationRuleOfSender.receivers
                            .filter(r => r.id !== receiver.id);
                        this.rulesSubject.next(this.clone(this.currentRules));
                    }
                }
            });
    }

    public checkAddLink(sender: GroupModel, receiver: GroupModel): Observable<{ warning: string }> {
        return this.http.get<{ warning: string }>(`/communication/v2/group/${sender.id}/communique/${receiver.id}/check`);
    }

    public createCommunication(sender: GroupModel, receiver: GroupModel): Observable<{ groupId: number, internalCommunicationRule: string }> {
        return this.http.post<CreateCommunicationResponse>(`/communication/v2/group/${sender.id}/communique/${receiver.id}`, {})
            .do((createCommunicationResponse: CreateCommunicationResponse) => {
                if (!isNoDirectionChangeResponse(createCommunicationResponse)) {
                    sender.internalCommunicationRule = createCommunicationResponse[sender.id];
                    receiver.internalCommunicationRule = createCommunicationResponse[receiver.id];
                }
                if (this.currentRules) {
                    const communicationRuleOfSender = this.currentRules.find(cr => cr.sender.id === sender.id);
                    if (!!communicationRuleOfSender) {
                        communicationRuleOfSender.receivers.push(receiver);
                        this.rulesSubject.next(this.clone(this.currentRules));
                    }
                }
            });
    }

    private getCommunicationRulesOfGroup(sender: GroupModel): Observable<CommunicationRule> {
        return this.http.get<GroupModel[]>(`/communication/group/${sender.id}/outgoing`)
            .map(receivers => ({sender, receivers}));
    }

    private clone(communicationRules: CommunicationRule[]): CommunicationRule[] {
        return communicationRules.map(cr => ({
            sender: Object.assign({}, cr.sender),
            receivers: cr.receivers.map(re => Object.assign({}, re))
        }));
    }

    private findGroups(communicationRules: CommunicationRule[], groupId: string): GroupModel[] {
        return communicationRules.reduce(
            (arrayOfGroups: GroupModel[], communicationRule: CommunicationRule): GroupModel[] =>
                [...arrayOfGroups, communicationRule.sender, ...communicationRule.receivers], [])
            .filter(group => group.id === groupId);
    }
}

