"""Planning lifecycle and template persistence using the existing isolated API fixture."""
import copy
import unittest
from uuid import uuid4
import test_coaching as journey

class TrainerPlanningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The baseline suite deletes its temporary SQLite file in tearDownClass.
        # Release pooled connections to that deleted inode before opening our fixture.
        from tenant_console import console_engine
        console_engine.dispose()
        journey.CoachingJourneyTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        journey.CoachingJourneyTests.tearDownClass.__func__(cls)
        from tenant_console import console_engine
        console_engine.dispose()
        journey.baseline._test_db.unlink(missing_ok=True)

    setUp = journey.CoachingJourneyTests.setUp
    req = journey.CoachingJourneyTests.req
    link = journey.CoachingJourneyTests.link

    def create(self, content=None):
        return self.req('POST','/plans','coach',201,json={'id':str(uuid4()),'tenant_id':self.tenant,'content':content or self.content})

    def test_empty_draft_publish_validation_and_archive_assignment(self):
        self.link()
        content={**self.content,'planning_status':'draft','days':[]}
        plan=self.create(content)
        payload={'athlete_ids':[self.ids['athlete']],'request_id':str(uuid4())}
        self.req('POST',f'/plans/{plan["id"]}/assign','coach',422,json=payload)
        self.req('PATCH',f'/plans/{plan["id"]}','coach',422,json={'expected_version':1,'content':{**content,'planning_status':'published'}})
        published=self.req('PATCH',f'/plans/{plan["id"]}','coach',json={'expected_version':1,'content':{**self.content,'planning_status':'published'}})
        self.assertEqual(published['version'],2)
        self.req('PATCH',f'/plans/{plan["id"]}','coach',409,json={'expected_version':1,'content':published['content']})
        self.req('PATCH',f'/plans/{plan["id"]}','coach',json={'expected_version':2,'content':{**published['content'],'planning_status':'archived'}})
        self.req('POST',f'/plans/{plan["id"]}/assign','coach',422,json=payload)

    def test_overlap_requires_acknowledgement_and_preserves_independent_copies(self):
        self.link();p=self.create()
        payload={'athlete_ids':[self.ids['athlete']],'request_id':str(uuid4())}
        first=self.req('POST',f'/plans/{p["id"]}/assign','coach',201,json=payload)
        replay=self.req('POST',f'/plans/{p["id"]}/assign','coach',201,json=payload)
        self.assertEqual(first,replay)
        payload['request_id']=str(uuid4())
        self.req('POST',f'/plans/{p["id"]}/assign','coach',409,json=payload)
        second=self.req('POST',f'/plans/{p["id"]}/assign','coach',201,json={**payload,'allow_overlap':True})
        self.assertNotEqual(first[0]['id'],second[0]['id'])
        own=self.req('GET','/overview')['plans']
        self.assertEqual(len([p for p in own if p['athlete_id']==self.ids['athlete']]),2)

    def test_workout_template_scopes_idempotency_and_concurrent_edit(self):
        self.link()
        payload={'id':str(uuid4()),'tenant_id':self.tenant,'content':copy.deepcopy(self.content['days'][0])}
        first=self.req('POST','/workout-templates','coach',201,json=payload)
        replay=self.req('POST','/workout-templates','coach',201,json=payload)
        self.assertEqual(first,replay)
        self.req('GET',f'/workout-templates?tenant_id={self.tenant}','athlete',403)
        self.req('POST','/workout-templates','othercoach',403,json=payload)
        payload['content']['name']='Updated workout'
        self.req('POST','/workout-templates','coach',409,json=payload)
        changed=self.req('POST','/workout-templates','coach',201,json={**payload,'expected_version':1})
        self.assertEqual(changed['version'],2)
        self.assertEqual(len(self.req('GET',f'/workout-templates?tenant_id={self.tenant}','coach')),1)
        payload['content']['exercises'][0]['seconds']=30
        self.req('POST','/workout-templates','coach',422,json={**payload,'expected_version':2})

    def test_rest_day_conflicts_and_program_range(self):
        self.create({**self.content,'rest_dates':[]})
        for dates in [[self.content['days'][0]['dates'][0]],['2000-01-01']]:
            self.req('POST','/plans','coach',422,json={'id':str(uuid4()),'tenant_id':self.tenant,'content':{**self.content,'rest_dates':dates}})

