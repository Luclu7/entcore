import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommunicationRulesService } from './communication-rules.service';
import { CommunicationRule } from './communication-rules.component';
import { generateGroup } from '../../shared/utils';
import { GroupModel } from '../../core/store/models';
import 'rxjs/add/operator/skip';

describe('CommunicationRulesService', () => {
    let communicationRulesService: CommunicationRulesService;
    let httpController: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CommunicationRulesService
            ],
            imports: [
                HttpClientTestingModule
            ]
        });
        communicationRulesService = TestBed.get(CommunicationRulesService);
        httpController = TestBed.get(HttpTestingController);
    });

    it('should retrieve outgoing communication and emit new communication rules when giving a list of groups', () => {
        let rules: CommunicationRule[] = [];
        communicationRulesService
            .changes()
            .subscribe(cr => rules = cr);
        communicationRulesService.setGroups([generateGroup('group1'), generateGroup('group2')]);
        httpController.expectOne('/communication/group/group1/outgoing').flush([]);
        httpController.expectOne('/communication/group/group2/outgoing').flush([generateGroup('group3')]);
        expect(rules.length).toBe(2);
        expect(rules[1].receivers[0].id).toBe('group3');
    });

    describe('toggleInternalCommunicationRule', () => {
        it(`should call DELETE /communication/group/myGroupId/users given group id 'myGroupId' and internal communication rule 'BOTH'`, () => {
            const group: GroupModel = generateGroup('myGroupId', 'BOTH');
            communicationRulesService.toggleInternalCommunicationRule(group).subscribe();
            const communicationGroupRequest = httpController.expectOne('/communication/group/myGroupId/users');
            expect(communicationGroupRequest.request.method).toBe('DELETE');
        });

        it(`should call POST /communication/group/myGroupId/users given group id 'myGroupId' and internal communication rule 'NONE'`, () => {
            const group: GroupModel = generateGroup('myGroupId', 'NONE');
            communicationRulesService.toggleInternalCommunicationRule(group).subscribe();
            expect(httpController.expectOne('/communication/group/myGroupId/users').request.method).toEqual('POST');
        });

        it(`should call POST /communication/group/myGroupId given group id 'myGroupId' and internal communication rule 'INCOMING'`, () => {
            const group: GroupModel = generateGroup('myGroupId', 'INCOMING');
            communicationRulesService.toggleInternalCommunicationRule(group).subscribe();
            expect(httpController.expectOne('/communication/group/myGroupId/users').request.method).toEqual('POST');
        });

        it(`should call POST /communication/group/myGroupId/users with direction BOTH given group id 'myGroupId' and internal communication rule 'OUTGOING'`, () => {
            const group: GroupModel = generateGroup('myGroupId', 'OUTGOING');
            communicationRulesService.toggleInternalCommunicationRule(group).subscribe();
            expect(httpController.expectOne('/communication/group/myGroupId/users').request.method).toBe('POST');
        });

        it(`should emit a new communication rules if the given group is part of the current communication rules as sender`, () => {
            const group1: GroupModel = generateGroup('group1', 'BOTH');
            const group2: GroupModel = generateGroup('group2', 'BOTH');
            const group3: GroupModel = generateGroup('group3', 'BOTH');
            let rules: CommunicationRule[] = [];
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(cr => rules = cr);
            communicationRulesService.setGroups([group1, group2]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);
            httpController.expectOne('/communication/group/group2/outgoing').flush([group3]);
            communicationRulesService.toggleInternalCommunicationRule(group1).subscribe();
            httpController.expectOne('/communication/group/group1/users').flush({users: null});
            expect(rules[0].sender.internalCommunicationRule).toBe('NONE');
        });

        it(`should emit a new communication rules if the given group is part of the current communication rules as a receiver`, () => {
            const group1: GroupModel = generateGroup('group1', 'BOTH');
            const group2: GroupModel = generateGroup('group2', 'BOTH');
            const group3: GroupModel = generateGroup('group3', 'BOTH');
            let rules: CommunicationRule[] = [];
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(cr => rules = cr);
            communicationRulesService.setGroups([group1, group2]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);
            httpController.expectOne('/communication/group/group2/outgoing').flush([group3]);
            communicationRulesService.toggleInternalCommunicationRule(group3).subscribe();
            httpController.expectOne('/communication/group/group3/users').flush({users: null});
            expect(rules[1].receivers[0].internalCommunicationRule).toBe('NONE');
        });

        it(`should not emit a new communication rules if the given group is not part of the current communication rules`, () => {
            const group1: GroupModel = generateGroup('group1', 'BOTH');
            const group2: GroupModel = generateGroup('group2', 'BOTH');
            const group3: GroupModel = generateGroup('group3', 'BOTH');
            let emitted: boolean = false;
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(() => emitted = true);
            communicationRulesService.setGroups([group1, group2]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);
            httpController.expectOne('/communication/group/group2/outgoing').flush([]);
            communicationRulesService.toggleInternalCommunicationRule(group3).subscribe();
            httpController.expectOne('/communication/group/group3/users').flush({users: null});
            expect(emitted).toBe(false);
        });
    });

    describe('removeCommunication', () => {
        it(`should call DELETE /communication/group/myGroup1/relations/myGroup2 given groups myGroup1, myGroup2`, () => {
            const group1: GroupModel = generateGroup('myGroup1');
            const group2: GroupModel = generateGroup('myGroup2');
            communicationRulesService.removeCommunication(group1, group2).subscribe();
            const communicationGroupRequest = httpController.expectOne('/communication/group/myGroup1/relations/myGroup2');
            expect(communicationGroupRequest.request.method).toBe('DELETE');
        });

        it(`should emit a new communication rules (without the receiver) if communication rule was in the monitored communication rules`, () => {
            const group1: GroupModel = generateGroup('group1');
            const group2: GroupModel = generateGroup('group2');
            const group3: GroupModel = generateGroup('group3');
            let rules: CommunicationRule[] = [];
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(cr => rules = cr);
            communicationRulesService.setGroups([group1, group2]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);
            httpController.expectOne('/communication/group/group2/outgoing').flush([group3]);
            communicationRulesService.removeCommunication(group2, group3).subscribe();
            httpController.expectOne('/communication/group/group2/relations/group3').flush(null);
            expect(rules[1].receivers.length).toBe(0);
        });
    });

    describe('createCommunication', () => {
        it('it should call POST /communication/v2/group/group1/communique/group2 given group1 and group2', () => {
            const group1: GroupModel = generateGroup('group1');
            const group2: GroupModel = generateGroup('group2');
            communicationRulesService.createCommunication(group1, group2).subscribe();
            httpController.expectOne('/communication/v2/group/group1/communique/group2');
        });

        it('it should emit rules with updated receivers', () => {
            const group1: GroupModel = generateGroup('group1', 'INCOMING');
            const group2: GroupModel = generateGroup('group2');
            let rules: CommunicationRule[] = [];
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(cr => rules = cr);
            communicationRulesService.setGroups([group1]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);

            communicationRulesService.createCommunication(group1, group2).subscribe();
            httpController.expectOne('/communication/v2/group/group1/communique/group2').flush({'ok': 'no direction to change'});

            expect(rules[0].sender.internalCommunicationRule).toBe('INCOMING');
            expect(rules[0].receivers[0].id).toBe('group2');
        });

        it('it should emit rules with updated receivers and internal com rule if the new rule changed it', () => {
            const group1: GroupModel = generateGroup('group1', 'INCOMING');
            const group2: GroupModel = generateGroup('group2');
            let rules: CommunicationRule[] = [];
            communicationRulesService
                .changes()
                .skip(1)
                .subscribe(cr => rules = cr);
            communicationRulesService.setGroups([group1]);
            httpController.expectOne('/communication/group/group1/outgoing').flush([]);

            communicationRulesService.createCommunication(group1, group2).subscribe();
            httpController.expectOne('/communication/v2/group/group1/communique/group2').flush({'group1': 'BOTH'});

            expect(rules[0].sender.internalCommunicationRule).toBe('BOTH');
            expect(rules[0].receivers[0].id).toBe('group2');
        });
    });
});
